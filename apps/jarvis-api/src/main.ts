import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { loadEnv } from '@umer/config';
import { createJarvisAuth, AuthenticationError, type AuthenticatedPrincipal } from '@umer/auth';
import { JarvisCore, type JarvisPrincipal } from '@umer/jarvis-core';
import { createJarvisControlTools, createAuthorizedJarvisTools } from '@umer/jarvis-tools';
import { initializePersistentJarvisMemory, type MemoryAccessPrincipal } from '@umer/jarvis-memory';
import { createLLMProviderFromEnv } from '@umer/model-routing';
import { TrustRuntime, InMemoryGrantStore, MySqlGrantStore } from '@umer/trust';
import { createMySqlClient, createMySqlExecutor } from '@umer/db';
import { InMemorySessionHistoryStore, MySqlSessionHistoryStore, type SessionHistoryStore } from './session-history-store.js';
import { requireAdmin, listGrants, createGrant, revokeGrant, GrantAdminError } from './grant-admin.js';

const env = loadEnv();
const port = Number(process.env.JARVIS_PORT ?? 3010);
const controlApiBaseUrl = process.env.CONTROL_API_BASE_URL ?? `http://127.0.0.1:${env.CONTROL_API_PORT}`;
const allowedOrigins = (process.env.JARVIS_CORS_ORIGINS ?? 'http://localhost:3001,http://127.0.0.1:3001')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
const sharedToken = process.env.JARVIS_API_TOKEN?.trim();
const bindHost = process.env.JARVIS_BIND_HOST ?? '127.0.0.1';

if (!sharedToken) {
  console.warn('[jarvis-api] JARVIS_API_TOKEN not set — accepting requests from localhost without authentication. Set JARVIS_API_TOKEN in production.');
}
const provider = createLLMProviderFromEnv({ env });
const memoryMode = (process.env.JARVIS_MEMORY_PERSISTENCE ?? 'mysql').toLowerCase();
const memory = memoryMode === 'mysql'
  ? await initializePersistentJarvisMemory({ principal: { principalId: 'jarvis-ceo', grantedScopes: ['read_write'] } })
  : undefined;
// Migrations for Trust grants and session history run as part of the same
// migrate() call above; reuse the same singleton MySQL pool for both, so
// durable Trust/session persistence is on exactly when durable memory is.
const mysqlExecutor = memoryMode === 'mysql' ? createMySqlExecutor(createMySqlClient()) : undefined;

const auth = createJarvisAuth();
const configuredPrincipal: AuthenticatedPrincipal = {
  principalId: process.env.JARVIS_DEV_PRINCIPAL_ID ?? 'ceo',
  kind: 'human',
  ...(process.env.JARVIS_TENANT_ID ? { tenantId: process.env.JARVIS_TENANT_ID } : {}),
};
const trustStore = mysqlExecutor ? new MySqlGrantStore(mysqlExecutor) : new InMemoryGrantStore();
const trust = new TrustRuntime({ store: trustStore });
const configuredActions = (process.env.JARVIS_TRUST_ACTIONS ?? (auth.mode === 'development' ? 'read,execute' : 'read'))
  .split(',').map((value) => value.trim()).filter(Boolean);
// Grants are now sourced from the durable Trust store, not re-asserted from
// this env var on every restart: only seed them the first time this
// principal has no grants at all. An operator who later revokes/edits
// grants directly in the store is not overwritten by the next restart.
const existingGrants = await trustStore.listForPrincipal(configuredPrincipal.principalId);
if (existingGrants.length === 0) {
  for (const action of configuredActions) {
    await trust.registerGrant({
      grantId: `jarvis-${configuredPrincipal.principalId}-${action}`,
      principalId: configuredPrincipal.principalId,
      action,
      resourceType: action === 'execute' ? 'command' : 'jarvis',
      effect: 'allow',
      ...(configuredPrincipal.tenantId ? { tenantId: configuredPrincipal.tenantId } : {}),
    });
  }
  // The bootstrap operator can administer grants for every principal seen
  // afterward (e.g. a newly-authenticated real OIDC user) via the
  // /v1/admin/grants routes below, instead of writing to trust_grants by hand.
  await trust.registerGrant({
    grantId: `jarvis-${configuredPrincipal.principalId}-admin`,
    principalId: configuredPrincipal.principalId,
    action: 'admin',
    resourceType: 'trust',
    effect: 'allow',
    ...(configuredPrincipal.tenantId ? { tenantId: configuredPrincipal.tenantId } : {}),
  });
}

const baseTools = createJarvisControlTools({ controlApiBaseUrl, memory });
const tools = createAuthorizedJarvisTools(baseTools, { trust, principal: configuredPrincipal });
const jarvis = new JarvisCore({ provider, tools, maxIterations: 12 });

const MAX_HISTORY = 20;
const historyStore: SessionHistoryStore = mysqlExecutor ? new MySqlSessionHistoryStore(mysqlExecutor, MAX_HISTORY) : new InMemorySessionHistoryStore(MAX_HISTORY);
const ATTENTION_POLL_MS = Math.max(Number(process.env.JARVIS_ATTENTION_POLL_MS ?? 15000), 5000);
const attentionClients = new Set<ServerResponse>();
let lastAttentionFingerprint = '';

function getCorsOrigin(req: IncomingMessage): string {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) return origin;
  // Localhost requests without Origin header (e.g. curl, same-origin) are allowed
  return allowedOrigins[0] ?? '*';
}

function send(res: ServerResponse, status: number, body: unknown, req?: IncomingMessage): void {
  const corsOrigin = req ? getCorsOrigin(req) : (allowedOrigins[0] ?? '*');
  res.writeHead(status, { 
    'content-type': 'application/json; charset=utf-8', 
    'access-control-allow-origin': corsOrigin, 
    'access-control-allow-methods': 'GET,POST,OPTIONS', 
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-allow-credentials': 'true'
  });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  if (Buffer.concat(chunks).length > 1_000_000) throw new Error('request body too large');
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('request body must be a JSON object');
  return parsed as Record<string, unknown>;
}

async function authenticateRequest(req: IncomingMessage, sessionId: string) {
  const authorization = typeof req.headers.authorization === 'string' ? req.headers.authorization : undefined;
  const session = await auth.authenticate(authorization, sessionId);
  await trust.bindPrincipal(session.principal, sessionId);
  return session;
}

function principalForJarvis(principal: AuthenticatedPrincipal): JarvisPrincipal {
  return { principalId: principal.principalId, kind: principal.kind, ...(principal.tenantId ? { tenantId: principal.tenantId } : {}) };
}

async function readAttention(): Promise<unknown> {
  const response = await fetch(`${controlApiBaseUrl.replace(/\/$/, '')}/v1/ceo/attention`, { headers: { accept: 'application/json' } });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`Control API returned HTTP ${response.status}`);
  return body;
}

function publishAttention(body: unknown): void {
  const payload = `event: attention\ndata: ${JSON.stringify(body)}\n\n`;
  for (const client of attentionClients) {
    try { client.write(payload); } catch { attentionClients.delete(client); }
  }
}

async function attentionTick(): Promise<void> {
  try {
    const attention = await readAttention();
    const fingerprint = JSON.stringify(attention);
    if (fingerprint !== lastAttentionFingerprint) {
      lastAttentionFingerprint = fingerprint;
      publishAttention({ receivedAt: new Date().toISOString(), attention });
    }
  } catch (error) {
    publishAttention({ receivedAt: new Date().toISOString(), error: error instanceof Error ? error.message : String(error) });
  }
}

function checkSharedToken(req: IncomingMessage): boolean {
  if (!sharedToken) return true; // No token configured, allow (localhost warning already logged)
  const authHeader = req.headers.authorization;
  if (!authHeader) return false;
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  return token === sharedToken;
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {}, req);
  if (req.method === 'GET' && req.url === '/health') return send(res, 200, { status: 'ok', service: 'jarvis-api', provider: provider.providerId, memoryPersistence: memoryMode, authMode: auth.mode, tools: tools.map((tool) => tool.name), proactiveAttention: true, attentionPollMs: ATTENTION_POLL_MS }, req);
  
  // Mutating endpoints require token auth when configured
  if (req.method === 'POST' && !checkSharedToken(req)) {
    return send(res, 401, { error: 'unauthorized', message: 'Valid authorization token required for mutating operations' }, req);
  }

  if (req.method === 'GET' && req.url === '/v1/jarvis/attention') {
    try {
      const sessionId = randomUUID();
      await authenticateRequest(req, sessionId);
      return send(res, 200, await readAttention(), req);
    } catch (error) {
      if (error instanceof AuthenticationError) return send(res, 401, { error: 'unauthenticated', message: error.message }, req);
      return send(res, 502, { error: 'attention_unavailable', message: error instanceof Error ? error.message : String(error) }, req);
    }
  }

  if (req.method === 'GET' && req.url === '/v1/jarvis/attention/stream') {
    try {
      await authenticateRequest(req, randomUUID());
    } catch (error) {
      if (error instanceof AuthenticationError) return send(res, 401, { error: 'unauthenticated', message: error.message }, req);
      return send(res, 500, { error: 'authentication_failed', message: error instanceof Error ? error.message : String(error) }, req);
    }
    res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache, no-transform', connection: 'keep-alive', 'access-control-allow-origin': getCorsOrigin(req) });
    res.write(': connected\n\n');
    attentionClients.add(res);
    try { res.write(`event: attention\ndata: ${JSON.stringify({ receivedAt: new Date().toISOString(), attention: await readAttention() })}\n\n`); } catch { /* next poll will retry */ }
    req.on('close', () => attentionClients.delete(res));
    return;
  }

  if (req.url === '/v1/admin/grants' || req.url?.startsWith('/v1/admin/grants?')) {
    try {
      const sessionId = randomUUID();
      const session = await authenticateRequest(req, sessionId);
      await requireAdmin(trust, session.principal, sessionId);

      if (req.method === 'GET') {
        const principalId = new URL(req.url, 'http://localhost').searchParams.get('principalId') ?? undefined;
        return send(res, 200, { grants: await listGrants(trustStore, principalId) }, req);
      }
      if (req.method === 'POST') {
        const body = await readJson(req);
        const grant = await createGrant(trustStore, {
          principalId: typeof body.principalId === 'string' ? body.principalId : '',
          action: typeof body.action === 'string' ? body.action : '',
          resourceType: typeof body.resourceType === 'string' ? body.resourceType : '',
          resourceId: typeof body.resourceId === 'string' ? body.resourceId : undefined,
          effect: body.effect === 'deny' ? 'deny' : 'allow',
          tenantId: typeof body.tenantId === 'string' ? body.tenantId : undefined,
        });
        return send(res, 201, { grant }, req);
      }
      return send(res, 405, { error: 'method_not_allowed' }, req);
    } catch (error) {
      if (error instanceof AuthenticationError) return send(res, 401, { error: 'unauthenticated', message: error.message }, req);
      if (error instanceof GrantAdminError) return send(res, error.code === 'FORBIDDEN' ? 403 : 400, { error: error.code.toLowerCase(), message: error.message }, req);
      return send(res, 500, { error: 'admin_grants_failed', message: error instanceof Error ? error.message : String(error) }, req);
    }
  }

  const grantMatch = req.url?.match(/^\/v1\/admin\/grants\/([^/?]+)$/);
  if (grantMatch && req.method === 'DELETE') {
    try {
      const sessionId = randomUUID();
      const session = await authenticateRequest(req, sessionId);
      await requireAdmin(trust, session.principal, sessionId);
      await revokeGrant(trustStore, decodeURIComponent(grantMatch[1]!));
      return send(res, 204, {}, req);
    } catch (error) {
      if (error instanceof AuthenticationError) return send(res, 401, { error: 'unauthenticated', message: error.message }, req);
      if (error instanceof GrantAdminError) return send(res, error.code === 'FORBIDDEN' ? 403 : 400, { error: error.code.toLowerCase(), message: error.message }, req);
      return send(res, 500, { error: 'admin_grants_failed', message: error instanceof Error ? error.message : String(error) }, req);
    }
  }

  if (req.method !== 'POST' || req.url !== '/v1/jarvis/chat') return send(res, 404, { error: 'not_found' }, req);

  try {
    const body = await readJson(req);
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const sessionId = typeof body.sessionId === 'string' && body.sessionId.trim() ? body.sessionId.trim() : randomUUID();
    if (!message) return send(res, 400, { error: 'message_required' }, req);

    const session = await authenticateRequest(req, sessionId);
    const history = await historyStore.get(sessionId);
    const correlationId = randomUUID();
    const result = await jarvis.respond(sessionId, message, {
      history,
      correlationId,
      principal: principalForJarvis(session.principal),
      authorize: (action, resourceType, resourceId) => trust.authorize({ principal: session.principal, action, resourceType, resourceId }, correlationId),
    });
    await historyStore.append(sessionId, [{ role: 'user', content: message }, { role: 'assistant', content: result.assistantMessage }]);
    if (memory) {
      const memoryPrincipal: MemoryAccessPrincipal = { principalId: session.principal.principalId, grantedScopes: ['read_write'], tenantId: session.principal.tenantId };
      try { await memory.rememberTurn(sessionId, message, result.assistantMessage, correlationId, memoryPrincipal); }
      catch (error) { console.warn('[jarvis-api] durable memory write failed; response remains successful', error); }
    }
    return send(res, 200, { ...result, correlationId, principalId: session.principal.principalId, memoryPersistence: memoryMode }, req);
  } catch (error) {
    if (error instanceof AuthenticationError) return send(res, 401, { error: 'unauthenticated', message: error.message }, req);
    return send(res, 500, { error: 'jarvis_failed', message: error instanceof Error ? error.message : String(error) }, req);
  }
});

server.listen(port, bindHost, () => {
  console.log(`JARVIS API listening on ${bindHost}:${port}`);
  console.log(`Memory persistence: ${memoryMode}`);
  console.log(`Authentication mode: ${auth.mode}`);
  console.log(`Trust actions for configured principal: ${configuredActions.join(', ') || 'none'}`);
  console.log(`Control-plane tools: ${tools.map((tool) => tool.name).join(', ')}`);
  console.log(`Proactive attention stream enabled; polling every ${ATTENTION_POLL_MS}ms`);
  console.log(`CORS allowed origins: ${allowedOrigins.join(', ')}`);
  if (!sharedToken) console.log('⚠️  No JARVIS_API_TOKEN configured — mutating endpoints accept localhost without auth');
});
void attentionTick();
const attentionTimer = setInterval(() => void attentionTick(), ATTENTION_POLL_MS);
server.on('close', () => clearInterval(attentionTimer));
