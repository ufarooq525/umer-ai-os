import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import type { Server } from 'node:http';
import { createControlApiServer, createControlApiState } from './server.js';
import type { ControlApiState } from './state.js';

async function request(
  server: Server,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('server not listening');
  const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, json: (await response.json()) as Record<string, unknown> };
}

describe('/v1/work-graph', () => {
  let state: ControlApiState;
  let server: Server;

  beforeEach(async () => {
    state = await createControlApiState();
    server = createControlApiServer(state);
    await new Promise<void>((resolve) => server.listen(0, resolve));
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('returns an honest empty graph for a project that has never been decomposed', async () => {
    const { status, json } = await request(server, 'GET', '/v1/work-graph/proj-unknown');
    expect(status).toBe(200);
    expect(json).toEqual({ projectId: 'proj-unknown', nodes: [], edges: [] });
  });

  it('decomposes a project into the real 9-node pipeline graph', async () => {
    const { status, json } = await request(server, 'POST', '/v1/work-graph/proj-1/decompose', {});
    expect(status).toBe(200);
    const nodes = json.nodes as Array<{ type: string; status: string }>;
    expect(nodes).toHaveLength(9);
    expect(nodes.find((n) => n.type === 'Requirements')?.status).toBe('Ready');
    expect(nodes.filter((n) => n.status === 'Blocked')).toHaveLength(8);
  });

  it('persists the decomposition — a follow-up GET reflects it', async () => {
    await request(server, 'POST', '/v1/work-graph/proj-2/decompose', {});
    const { json } = await request(server, 'GET', '/v1/work-graph/proj-2');
    expect((json.nodes as unknown[]).length).toBe(9);
    expect((json.edges as unknown[]).length).toBe(10);
  });

  it('rejects decomposing the same project+slug twice, without corrupting the existing graph', async () => {
    await request(server, 'POST', '/v1/work-graph/proj-3/decompose', {});
    const second = await request(server, 'POST', '/v1/work-graph/proj-3/decompose', {});
    expect(second.status).toBe(400);

    const { json } = await request(server, 'GET', '/v1/work-graph/proj-3');
    expect((json.nodes as unknown[]).length).toBe(9);
  });

  it('keeps two projects fully isolated', async () => {
    await request(server, 'POST', '/v1/work-graph/proj-a/decompose', {});
    const { json } = await request(server, 'GET', '/v1/work-graph/proj-b');
    expect(json).toEqual({ projectId: 'proj-b', nodes: [], edges: [] });
  });
});
