import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AgentSnapshot } from '@umer/observability';
import { InMemoryAgentRegistryStore } from '@umer/observability';
import type { Opportunity } from '@umer/contracts';
import { createControlApiServer, createControlApiState } from './server.js';

async function post(server: Server, path: string, body: unknown): Promise<{ status: number; json: unknown }> {
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('server not listening');
  }
  const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, json: await response.json() };
}

async function get(server: Server, path: string): Promise<{ status: number; json: unknown }> {
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('server not listening');
  }
  const response = await fetch(`http://127.0.0.1:${address.port}${path}`);
  return { status: response.status, json: await response.json() };
}

function makeOpportunity(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: 'opp-e2e-1',
    type: 'product',
    title: 'Telehealth billing automation',
    geography: 'US',
    market: 'Healthcare SaaS',
    problemIds: ['prob-1'],
    score: {
      problemSeverity: 80,
      demandEvidence: 70,
      abilityToPay: 60,
      reachability: 50,
      solutionFit: 75,
      competitiveGap: 40,
      deliveryFeasibility: 65,
      evidenceConfidence: 70,
      overall: 65,
      recommendation: 'outreach_ready',
    },
    evidenceRefs: ['ev-1'],
    status: 'discovered',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const ceoActor = { principalId: 'human.ceo', kind: 'human' as const };
const agentActor = { principalId: 'agent-growth-1', kind: 'specialist_run' as const };

describe('control-api — CEO Command & Decision Plane (POST /v1/commands)', () => {
  let server: Server;

  beforeAll(async () => {
    const state = await createControlApiState();
    await state.opportunityReader!.saveOpportunity(makeOpportunity());
    state.agentRegistry = new InMemoryAgentRegistryStore();
    const snapshot: AgentSnapshot = {
      agentId: 'agent-growth-1',
      specialistId: 'growth.opportunity-research',
      status: 'idle',
      lastSeenAt: '2026-01-01T00:00:00.000Z',
    };
    await state.agentRegistry.upsert(snapshot);

    server = createControlApiServer(state);
    await new Promise<void>((resolve) => server.listen(0, resolve));
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  });

  it('end-to-end: SelectOpportunity -> CreateProjectFromOpportunity -> read models reflect the result', async () => {
    const select = await post(server, '/v1/commands', {
      name: 'SelectOpportunity',
      actor: ceoActor,
      target: { entityType: 'opportunity', entityId: 'opp-e2e-1' },
      payload: { opportunityId: 'opp-e2e-1' },
    });
    expect(select.status).toBe(201);
    expect((select.json as { status: string }).status).toBe('applied');

    const afterSelect = await get(server, '/v1/opportunities/opp-e2e-1');
    expect((afterSelect.json as Opportunity).status).toBe('selected_for_execution');

    const createProject = await post(server, '/v1/commands', {
      name: 'CreateProjectFromOpportunity',
      actor: ceoActor,
      payload: { opportunityId: 'opp-e2e-1', owner: 'Growth Lead' },
    });
    expect(createProject.status).toBe(201);
    const projectId = ((createProject.json as { data: { project: { projectId: string } } }).data.project).projectId;

    const afterCreate = await get(server, '/v1/opportunities/opp-e2e-1');
    expect((afterCreate.json as Opportunity).status).toBe('project_created');

    const projectRead = await get(server, `/v1/work-projects/${projectId}`);
    expect(projectRead.status).toBe(200);
    expect((projectRead.json as { sourceOpportunityId: string }).sourceOpportunityId).toBe('opp-e2e-1');
  });

  it('rejects an unauthorized actor with 403', async () => {
    const result = await post(server, '/v1/commands', {
      name: 'RejectOpportunity',
      actor: agentActor,
      payload: { opportunityId: 'opp-e2e-1' },
    });
    expect(result.status).toBe(403);
    expect((result.json as { error: string }).error).toBe('UNAUTHORIZED');
  });

  it('rejects a malformed payload with 400', async () => {
    const result = await post(server, '/v1/commands', {
      name: 'SelectOpportunity',
      actor: ceoActor,
      payload: {},
    });
    expect(result.status).toBe(400);
  });

  it('rejects an unknown target with 404', async () => {
    const result = await post(server, '/v1/commands', {
      name: 'PauseProject',
      actor: ceoActor,
      payload: { projectId: 'does-not-exist' },
    });
    expect(result.status).toBe(404);
    expect((result.json as { error: string }).error).toBe('NOT_FOUND');
  });

  it('is idempotent on a repeated commandId: second delivery returns the same result without a duplicate state transition', async () => {
    const commandId = 'cmd-idempotency-e2e-1';
    const body = {
      commandId,
      name: 'PauseAgent',
      actor: ceoActor,
      payload: { agentId: 'agent-growth-1', reason: 'incident' },
    };

    const first = await post(server, '/v1/commands', body);
    expect(first.status).toBe(201);
    expect((first.json as { status: string }).status).toBe('applied');

    const second = await post(server, '/v1/commands', body);
    expect(second.status).toBe(200);
    expect((second.json as { status: string }).status).toBe('duplicate');
    expect((second.json as { commandId: string }).commandId).toBe(commandId);

    // PauseAgent is now observable through the read model, but only happened once.
    const agentRead = await get(server, '/v1/agents/agent-growth-1');
    expect((agentRead.json as { controlState: string }).controlState).toBe('paused');
  });

  it('an unauthorized actor cannot replay a known commandId to read back another actor result', async () => {
    const commandId = 'cmd-idempotency-e2e-security-1';
    const original = await post(server, '/v1/commands', {
      commandId,
      name: 'CreateProject',
      actor: ceoActor,
      payload: { name: 'Confidential Project' },
    });
    expect(original.status).toBe(201);

    const replay = await post(server, '/v1/commands', {
      commandId,
      name: 'CreateProject',
      actor: agentActor,
      payload: { name: 'Confidential Project' },
    });
    expect(replay.status).toBe(403);
    expect((replay.json as { error: string }).error).toBe('UNAUTHORIZED');
    // The unauthorized replay must not have received the original's data.
    expect(replay.json).not.toHaveProperty('data');
  });

  it('PauseAgent then CancelWork on a task the agent holds cancels the task and stays observable on GET /v1/tasks/:id', async () => {
    const project = ((await post(server, '/v1/commands', {
      name: 'CreateProject',
      actor: ceoActor,
      payload: { name: 'CancelWork test project' },
    })).json as { data: { projectId: string } }).data;

    const task = ((await post(server, '/v1/commands', {
      name: 'CreateTask',
      actor: ceoActor,
      payload: {
        epicId: 'epic-1',
        projectId: project.projectId,
        title: 'Do the thing',
        description: 'Details',
        acceptanceCriteria: ['done'],
      },
    })).json as { data: { taskId: string } }).data;

    await post(server, '/v1/commands', {
      name: 'AssignTask',
      actor: ceoActor,
      payload: { taskId: task.taskId, agentId: 'agent-growth-1' },
    });

    const cancel = await post(server, '/v1/commands', {
      name: 'CancelWork',
      actor: ceoActor,
      payload: { agentId: 'agent-growth-1', taskId: task.taskId, reason: 'no longer needed' },
    });
    expect(cancel.status).toBe(201);

    const taskRead = await get(server, `/v1/tasks/${task.taskId}`);
    expect((taskRead.json as { status: string }).status).toBe('Cancelled');
  });
});
