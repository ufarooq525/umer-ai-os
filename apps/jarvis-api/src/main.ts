import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { loadEnv } from '@umer/config';
import { JarvisCore } from '@umer/jarvis-core';
import { createLLMProviderFromEnv } from '@umer/model-routing';

const env = loadEnv();
const port = Number(process.env.JARVIS_PORT ?? 3010);
const provider = createLLMProviderFromEnv({ env });
const jarvis = new JarvisCore({ provider });

const sessions = new Map<string, Array<{ role: 'user' | 'assistant'; content: string }>>();
const MAX_HISTORY = 20;

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type, authorization',
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

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method === 'GET' && req.url === '/health') {
    return send(res, 200, { status: 'ok', service: 'jarvis-api', provider: provider.providerId });
  }
  if (req.method !== 'POST' || req.url !== '/v1/jarvis/chat') {
    return send(res, 404, { error: 'not_found' });
  }

  try {
    const body = await readJson(req);
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const sessionId = typeof body.sessionId === 'string' && body.sessionId.trim() ? body.sessionId.trim() : crypto.randomUUID();
    if (!message) return send(res, 400, { error: 'message_required' });

    const history = sessions.get(sessionId) ?? [];
    const result = await jarvis.respond(sessionId, message, { history });
    const nextHistory = [
      ...history,
      { role: 'user' as const, content: message },
      { role: 'assistant' as const, content: result.assistantMessage },
    ].slice(-MAX_HISTORY);
    sessions.set(sessionId, nextHistory);

    return send(res, 200, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return send(res, 500, { error: 'jarvis_failed', message });
  }
});

server.listen(port, () => {
  console.log(`JARVIS API listening on http://127.0.0.1:${port}`);
});
