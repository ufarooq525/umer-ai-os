import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { loadEnv } from '@umer/config';
import { JarvisCore } from '@umer/jarvis-core';
import { createJarvisControlTools } from '@umer/jarvis-tools';
import { initializePersistentJarvisMemory } from '@umer/jarvis-memory';
import { createLLMProviderFromEnv } from '@umer/model-routing';

const env = loadEnv();
const port = Number(process.env.JARVIS_PORT ?? 3010);
const controlApiBaseUrl = process.env.CONTROL_API_BASE_URL ?? 'http://127.0.0.1:3002';
const provider = createLLMProviderFromEnv({ env });
const memoryMode = (process.env.JARVIS_MEMORY_PERSISTENCE ?? 'mysql').toLowerCase();
const memory = memoryMode === 'mysql'
  ? await initializePersistentJarvisMemory({ principal: { principalId: 'jarvis-ceo', grantedScopes: ['read_write'] } })
  : undefined;
const tools = createJarvisControlTools({ controlApiBaseUrl, memory });
const jarvis = new JarvisCore({ provider, tools, maxIterations: 12 });

const sessions = new Map<string, Array<{ role: 'user' | 'assistant'; content: string }>>();
const MAX_HISTORY = 20;
const ATTENTION_POLL_MS = Math.max(Number(process.env.JARVIS_ATTENTION_POLL_MS ?? 15000), 5000);
const attentionClients = new Set<ServerResponse>();
let lastAttentionFingerprint = '';

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type, authorization' });
  res.end(JSON.stringify(body));
}
async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk));
  if (Buffer.concat(chunks).length > 1_000_000) throw new Error('request body too large');
  const raw = Buffer.concat(chunks).toString('utf8'); if (!raw) return {};
  const parsed: unknown = JSON.parse(raw); if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('request body must be a JSON object');
  return parsed as Record<string, unknown>;
}
async function readAttention(): Promise<unknown> {
  const response = await fetch(`${controlApiBaseUrl.replace(/\/$/, '')}/v1/ceo/attention`, { headers: { accept: 'application/json' } });
  const text = await response.text(); const body = text ? JSON.parse(text) : null; if (!response.ok) throw new Error(`Control API returned HTTP ${response.status}`); return body;
}
function publishAttention(body: unknown): void { const payload = `event: attention\\ndata: ${JSON.stringify(body)}\\n\\n`; for (const client of attentionClients) { try { client.write(payload); } catch { attentionClients.delete(client); } } }
async function attentionTick(): Promise<void> { try { const attention = await readAttention(); const fingerprint = JSON.stringify(attention); if (fingerprint !== lastAttentionFingerprint) { lastAttentionFingerprint = fingerprint; publishAttention({ receivedAt: new Date().toISOString(), attention }); } } catch (error) { publishAttention({ receivedAt: new Date().toISOString(), error: error instanceof Error ? error.message : String(error) }); } }

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method === 'GET' && req.url === '/health') return send(res, 200, { status: 'ok', service: 'jarvis-api', provider: provider.providerId, memoryPersistence: memoryMode, tools: tools.map((tool) => tool.name), proactiveAttention: true, attentionPollMs: ATTENTION_POLL_MS });
  if (req.method === 'GET' && req.url === '/v1/jarvis/attention') { try { return send(res, 200, await readAttention()); } catch (error) { return send(res, 502, { error: 'attention_unavailable', message: error instanceof Error ? error.message : String(error) }); } }
  if (req.method === 'GET' && req.url === '/v1/jarvis/attention/stream') {
    res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache, no-transform', connection: 'keep-alive', 'access-control-allow-origin': '*' });
    res.write(': connected\\n\\n'); attentionClients.add(res); try { res.write(`event: attention\\ndata: ${JSON.stringify({ receivedAt: new Date().toISOString(), attention: await readAttention() })}\\n\\n`); } catch { /* next poll will retry */ }
    req.on('close', () => attentionClients.delete(res)); return;
  }
  if (req.method !== 'POST' || req.url !== '/v1/jarvis/chat') return send(res, 404, { error: 'not_found' });
  try {
    const body = await readJson(req); const message = typeof body.message === 'string' ? body.message.trim() : ''; const sessionId = typeof body.sessionId === 'string' && body.sessionId.trim() ? body.sessionId.trim() : randomUUID();
    if (!message) return send(res, 400, { error: 'message_required' });
    const history = sessions.get(sessionId) ?? []; const correlationId = randomUUID();
    const result = await jarvis.respond(sessionId, message, { history, correlationId });
    sessions.set(sessionId, [...history, { role: 'user' as const, content: message }, { role: 'assistant' as const, content: result.assistantMessage }].slice(-MAX_HISTORY));
    if (memory) { try { await memory.rememberTurn(sessionId, message, result.assistantMessage, correlationId); } catch (error) { console.warn('[jarvis-api] durable memory write failed; response remains successful', error); } }
    return send(res, 200, { ...result, correlationId, memoryPersistence: memoryMode });
  } catch (error) { return send(res, 500, { error: 'jarvis_failed', message: error instanceof Error ? error.message : String(error) }); }
});

server.listen(port, () => { console.log(`JARVIS API listening on port ${port}`); console.log(`Memory persistence: ${memoryMode}`); console.log(`Control-plane tools: ${tools.map((tool) => tool.name).join(', ')}`); console.log(`Proactive attention stream enabled; polling every ${ATTENTION_POLL_MS}ms`); });
void attentionTick(); const attentionTimer = setInterval(() => void attentionTick(), ATTENTION_POLL_MS); server.on('close', () => clearInterval(attentionTimer));
