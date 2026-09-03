import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import { InMemoryAgentRunReadModelStore, type AgentRunSnapshot } from '@umer/observability';
import { createControlApiServer, createControlApiState } from './server.js';

async function request(server: Server, path: string): Promise<{ status: number; json: unknown }> {
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('server not listening');
  }
  const response = await fetch(`http://127.0.0.1:${address.port}${path}`);
  return { status: response.status, json: await response.json() };
}

const runningSnapshot: AgentRunSnapshot = {
  workPackageId: 'wp-route-1',
  execId: 'EXEC-1',
  specialistId: 'growth.opportunity-research',
  correlationId: 'corr-route-1',
  status: 'running',
  currentAction: 'executing_tool',
  currentTool: 'search_web',
  currentToolInput: { query: 'x' },
  startedAt: '2026-09-03T00:00:00.000Z',
  updatedAt: '2026-09-03T00:00:01.000Z',
  toolCalls: [
    { toolCallId: 'call_1', tool: 'search_web', status: 'started', requestedAt: '2026-09-03T00:00:01.000Z', updatedAt: '2026-09-03T00:00:01.000Z' },
  ],
  decisions: [],
  actionLog: [{ at: '2026-09-03T00:00:00.000Z', event: 'agent.run.started', summary: 'Run started for specialist growth.opportunity-research' }],
  failures: [],
};

const completedSnapshot: AgentRunSnapshot = {
  ...runningSnapshot,
  workPackageId: 'wp-route-2',
  specialistId: 'eng.app-delivery',
  status: 'completed',
  currentAction: 'idle',
  currentTool: undefined,
  currentToolInput: undefined,
  finishedAt: '2026-09-03T00:01:00.000Z',
  artifactId: 'art-route-2',
  summary: 'done',
};

describe('control-api /v1/agent-runs', () => {
  let server: Server;

  beforeAll(async () => {
    const state = await createControlApiState();
    state.agentRunReadModel = new InMemoryAgentRunReadModelStore();
    await state.agentRunReadModel.upsert(runningSnapshot);
    await state.agentRunReadModel.upsert(completedSnapshot);
    server = createControlApiServer(state);
    await new Promise<void>((resolve) => server.listen(0, resolve));
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  });

  it('lists every known agent run', async () => {
    const { status, json } = await request(server, '/v1/agent-runs');
    expect(status).toBe(200);
    const body = json as { agentRuns: AgentRunSnapshot[] };
    expect(body.agentRuns.map((r) => r.workPackageId).sort()).toEqual(['wp-route-1', 'wp-route-2']);
  });

  it('filters by status', async () => {
    const { json } = await request(server, '/v1/agent-runs?status=completed');
    const body = json as { agentRuns: AgentRunSnapshot[] };
    expect(body.agentRuns).toHaveLength(1);
    expect(body.agentRuns[0]?.workPackageId).toBe('wp-route-2');
  });

  it('returns a single agent run with full CEO-checklist state — currently executing tool', async () => {
    const { status, json } = await request(server, '/v1/agent-runs/wp-route-1');
    expect(status).toBe(200);
    const snapshot = json as AgentRunSnapshot;
    expect(snapshot.specialistId).toBe('growth.opportunity-research');
    expect(snapshot.status).toBe('running');
    expect(snapshot.currentAction).toBe('executing_tool');
    expect(snapshot.currentTool).toBe('search_web');
    expect(snapshot.currentToolInput).toEqual({ query: 'x' });
    expect(snapshot.actionLog).toHaveLength(1);
  });

  it('returns a single agent run — completed with artifact', async () => {
    const { json } = await request(server, '/v1/agent-runs/wp-route-2');
    const snapshot = json as AgentRunSnapshot;
    expect(snapshot.status).toBe('completed');
    expect(snapshot.artifactId).toBe('art-route-2');
  });

  it('404s for an unknown work package', async () => {
    const { status } = await request(server, '/v1/agent-runs/does-not-exist');
    expect(status).toBe(404);
  });
});
