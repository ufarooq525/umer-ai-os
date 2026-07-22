import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import {
  bootstrapDemoState,
  createControlApiServer,
  createControlApiState,
} from './server.js';

async function request(
  server: Server,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('server not listening');
  }
  const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, json: (await response.json()) as Record<string, unknown> };
}

describe('control-api', () => {
  const state = createControlApiState();
  const server = createControlApiServer(state);

  beforeAll(async () => {
    await bootstrapDemoState(state);
    await new Promise<void>((resolve) => server.listen(0, resolve));
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('returns dashboard summary', async () => {
    const { status, json } = await request(server, 'GET', '/v1/dashboard');
    expect(status).toBe(200);
    expect(json.pendingGates).toBe(1);
    expect(json.workPackagesAwaitingReview).toBe(1);
  });

  it('lists pending gates', async () => {
    const { status, json } = await request(server, 'GET', '/v1/gates/pending');
    expect(status).toBe(200);
    expect((json.gates as unknown[]).length).toBeGreaterThan(0);
  });

  it('resolves a pending gate', async () => {
    const pending = await request(server, 'GET', '/v1/gates/pending');
    const waitId = (pending.json.gates as { waitId: string }[])[0]!.waitId;
    const { status, json } = await request(server, 'POST', `/v1/gates/${waitId}/resolve`, {
      decision: 'Pass',
      approver: 'human.approver',
      rationale: 'QA evidence verified in control plane UI',
    });
    expect(status).toBe(200);
    expect((json.record as { status: string }).status).toBe('passed');
  });
});
