import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import type { Server } from 'node:http';
import { createControlApiServer, createControlApiState } from './server.js';
import { InMemoryRequirementStore } from './requirement-store.js';
import type { ControlApiState } from './state.js';

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

describe('control-api /v1/requirements', () => {
  let state: ControlApiState;
  let server: Server;

  beforeEach(async () => {
    state = await createControlApiState();
    state.requirementStore = new InMemoryRequirementStore();
    server = createControlApiServer(state);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  });

  it('GET /v1/requirements returns an honest empty list when nothing was created', async () => {
    const { status, json } = await request(server, 'GET', '/v1/requirements');
    expect(status).toBe(200);
    expect(json.requirements).toEqual([]);
  });

  it('lists real persisted requirements and filters by projectId', async () => {
    const a = await state.requirementStore!.create({
      projectId: 'proj-a',
      title: 'A',
      problem: 'p',
      desiredOutcome: 'd',
      acceptanceCriteria: ['x'],
      source: { kind: 'Request', label: 'test' },
    });
    await state.requirementStore!.create({
      projectId: 'proj-b',
      title: 'B',
      problem: 'p',
      desiredOutcome: 'd',
      acceptanceCriteria: ['x'],
      source: { kind: 'Request', label: 'test' },
    });

    const all = await request(server, 'GET', '/v1/requirements');
    expect((all.json.requirements as unknown[]).length).toBe(2);

    const filtered = await request(server, 'GET', '/v1/requirements?projectId=proj-a');
    const requirements = filtered.json.requirements as Array<{ requirementId: string }>;
    expect(requirements).toHaveLength(1);
    expect(requirements[0]?.requirementId).toBe(a.requirementId);
  });

  it('GET /v1/requirements/:id returns 404 for an unknown id', async () => {
    const { status, json } = await request(server, 'GET', '/v1/requirements/req-missing');
    expect(status).toBe(404);
    expect(json.error).toContain('req-missing');
  });

  it('GET /v1/requirements/:id returns the real record', async () => {
    const created = await state.requirementStore!.create({
      title: 'A',
      problem: 'p',
      desiredOutcome: 'd',
      acceptanceCriteria: ['x'],
      source: { kind: 'Request', label: 'test' },
    });
    const { status, json } = await request(server, 'GET', `/v1/requirements/${created.requirementId}`);
    expect(status).toBe(200);
    expect(json.requirementId).toBe(created.requirementId);
    expect(json.status).toBe('Draft');
  });

  it('POST /v1/requirements/:id/decide approves a requirement', async () => {
    const created = await state.requirementStore!.create({
      title: 'A',
      problem: 'p',
      desiredOutcome: 'd',
      acceptanceCriteria: ['x'],
      source: { kind: 'Request', label: 'test' },
    });

    const { status, json } = await request(server, 'POST', `/v1/requirements/${created.requirementId}/decide`, {
      decision: 'Approved',
      decidedBy: 'human.ceo',
    });

    expect(status).toBe(200);
    expect(json.status).toBe('Accepted');

    const audits = await state.auditService.query();
    expect(audits.some((a) => a.action === 'requirement.accepted' && a.resourceId === created.requirementId)).toBe(true);
  });

  it('POST /v1/requirements/:id/decide rejects a requirement and the rejection is final', async () => {
    const created = await state.requirementStore!.create({
      title: 'A',
      problem: 'p',
      desiredOutcome: 'd',
      acceptanceCriteria: ['x'],
      source: { kind: 'Request', label: 'test' },
    });

    const rejected = await request(server, 'POST', `/v1/requirements/${created.requirementId}/decide`, {
      decision: 'Rejected',
      decidedBy: 'human.ceo',
      reason: 'Out of scope',
    });
    expect(rejected.status).toBe(200);
    expect(rejected.json.status).toBe('Rejected');

    // A rejected requirement can never accidentally become Accepted later.
    const reapproved = await request(server, 'POST', `/v1/requirements/${created.requirementId}/decide`, {
      decision: 'Approved',
      decidedBy: 'human.ceo',
    });
    expect(reapproved.status).toBe(409);

    const stillRejected = await request(server, 'GET', `/v1/requirements/${created.requirementId}`);
    expect(stillRejected.json.status).toBe('Rejected');
  });

  it('POST /v1/requirements/:id/decide validates the decision and decidedBy fields', async () => {
    const created = await state.requirementStore!.create({
      title: 'A',
      problem: 'p',
      desiredOutcome: 'd',
      acceptanceCriteria: ['x'],
      source: { kind: 'Request', label: 'test' },
    });

    const badDecision = await request(server, 'POST', `/v1/requirements/${created.requirementId}/decide`, {
      decision: 'Maybe',
      decidedBy: 'human.ceo',
    });
    expect(badDecision.status).toBe(400);

    const missingDecidedBy = await request(server, 'POST', `/v1/requirements/${created.requirementId}/decide`, {
      decision: 'Approved',
    });
    expect(missingDecidedBy.status).toBe(400);
  });

  it('POST /v1/requirements/:id/decide returns 404 for an unknown requirement', async () => {
    const { status } = await request(server, 'POST', '/v1/requirements/req-missing/decide', {
      decision: 'Approved',
      decidedBy: 'human.ceo',
    });
    expect(status).toBe(404);
  });
});
