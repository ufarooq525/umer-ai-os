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

describe('POST /v1/work-graph/:projectId/audit', () => {
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

  it('seeds a standalone, immediately-Ready QA node on a real project', async () => {
    const project = await state.projectStore!.create({ name: 'Audit Target' }, 'corr-setup');

    const { status, json } = await request(server, 'POST', `/v1/work-graph/${project.projectId}/audit`, {
      type: 'QA',
      requestedBy: 'hasnukhan390@gmail.com',
    });

    expect(status).toBe(201);
    const node = json.node as { type: string; status: string; title: string };
    expect(node.type).toBe('QA');
    expect(node.status).toBe('Ready');
    expect(node.title).toBe('QA Audit');
    expect((json.nodes as unknown[])).toHaveLength(1);
  });

  it('rejects an unknown node type without seeding anything', async () => {
    const project = await state.projectStore!.create({ name: 'Audit Target' }, 'corr-setup');

    const { status, json } = await request(server, 'POST', `/v1/work-graph/${project.projectId}/audit`, {
      type: 'Architecture',
      requestedBy: 'hasnukhan390@gmail.com',
    });

    expect(status).toBe(400);
    expect(json.error).toMatch(/UX.*QA.*Security/);
    const { json: graphJson } = await request(server, 'GET', `/v1/work-graph/${project.projectId}`);
    expect((graphJson.nodes as unknown[])).toHaveLength(0);
  });

  it('rejects a missing requestedBy', async () => {
    const project = await state.projectStore!.create({ name: 'Audit Target' }, 'corr-setup');

    const { status, json } = await request(server, 'POST', `/v1/work-graph/${project.projectId}/audit`, {
      type: 'UX',
    });

    expect(status).toBe(400);
    expect(json.error).toMatch(/requestedBy/);
  });

  it('404s for a project that does not exist rather than seeding an orphaned node', async () => {
    const { status, json } = await request(server, 'POST', '/v1/work-graph/proj-does-not-exist/audit', {
      type: 'Security',
      requestedBy: 'hasnukhan390@gmail.com',
    });

    expect(status).toBe(404);
    expect(json.error).toMatch(/not found/);
  });

  it('lets a QA node and a Security node coexist on the same project', async () => {
    const project = await state.projectStore!.create({ name: 'Audit Target' }, 'corr-setup');

    await request(server, 'POST', `/v1/work-graph/${project.projectId}/audit`, {
      type: 'QA',
      requestedBy: 'hasnukhan390@gmail.com',
    });
    await request(server, 'POST', `/v1/work-graph/${project.projectId}/audit`, {
      type: 'Security',
      requestedBy: 'hasnukhan390@gmail.com',
    });

    const { json } = await request(server, 'GET', `/v1/work-graph/${project.projectId}`);
    const types = (json.nodes as Array<{ type: string }>).map((n) => n.type).sort();
    expect(types).toEqual(['QA', 'Security']);
  });
});
