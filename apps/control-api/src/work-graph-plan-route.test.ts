import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { Server } from 'node:http';
import type { CommandEnvelope } from '@umer/contracts';
import { SUBJECTS } from '@umer/message-fabric';
import { ORCHESTRATION_COMMANDS } from '@umer/orchestration';
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

describe('POST /v1/work-graph/:projectId/plan', () => {
  let state: ControlApiState;
  let server: Server;
  let publishCommand: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    state = await createControlApiState();
    publishCommand = vi.fn().mockResolvedValue(undefined);
    state.fabric = { publishCommand } as unknown as ControlApiState['fabric'];
    server = createControlApiServer(state);
    await new Promise<void>((resolve) => server.listen(0, resolve));
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('requires an approver', async () => {
    const { status, json } = await request(server, 'POST', '/v1/work-graph/proj-1/plan', {});
    expect(status).toBe(400);
    expect(json.error).toContain('approver');
    expect(publishCommand).not.toHaveBeenCalled();
  });

  it('reports no ready nodes for a project with no Work Graph, without creating any Task or publishing a command', async () => {
    const { status, json } = await request(server, 'POST', '/v1/work-graph/proj-1/plan', {
      approver: 'human.ceo',
    });
    expect(status).toBe(200);
    expect(json.readyNodeIds).toEqual([]);
    expect(publishCommand).not.toHaveBeenCalled();
  });

  it('creates a real Task per ready node and publishes workgraph.plan with the real task ids', async () => {
    await request(server, 'POST', '/v1/work-graph/proj-1/decompose', {});

    const { status, json } = await request(server, 'POST', '/v1/work-graph/proj-1/plan', {
      approver: 'human.ceo',
    });

    expect(status).toBe(202);
    // Only 'Requirements' has no predecessor, so it's the only Ready node right after decomposition.
    expect(json.readyNodeIds).toEqual(['proj-1-requirements']);
    const taskIdsByNodeId = json.taskIdsByNodeId as Record<string, string[]>;
    const taskId = taskIdsByNodeId['proj-1-requirements']![0]!;
    expect(taskId).toBeDefined();

    const task = await state.taskStore!.get(taskId);
    expect(task).toMatchObject({ projectId: 'proj-1', title: 'Requirements' });

    expect(publishCommand).toHaveBeenCalledTimes(1);
    const [subject, command] = publishCommand.mock.calls[0] as [string, CommandEnvelope];
    expect(subject).toBe(SUBJECTS.CMD_ORCHESTRATION);
    expect(command.name).toBe(ORCHESTRATION_COMMANDS.PLAN_PROJECT);
    expect(command.payload).toMatchObject({
      projectId: 'proj-1',
      taskIdsByNodeId: { 'proj-1-requirements': [taskId] },
    });
  });

  it('responds 503 when the message fabric is not connected', async () => {
    state.fabric = undefined;
    await request(server, 'POST', '/v1/work-graph/proj-2/decompose', {});

    const { status } = await request(server, 'POST', '/v1/work-graph/proj-2/plan', { approver: 'human.ceo' });
    expect(status).toBe(503);
  });
});
