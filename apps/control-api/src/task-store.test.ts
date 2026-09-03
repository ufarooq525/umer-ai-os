import { describe, expect, it, vi } from 'vitest';
import { InMemoryTaskStore } from './task-store.js';

const baseInput = {
  epicId: 'epic-1',
  projectId: 'proj-1',
  title: 'Research healthcare SaaS opportunities',
  description: 'Find and evidence candidate opportunities',
  acceptanceCriteria: ['At least 2 evidenced findings'],
};

describe('InMemoryTaskStore', () => {
  it('creates a Task defaulting to Backlog status and emits task.created', async () => {
    const events = { publish: vi.fn().mockResolvedValue(undefined) };
    const store = new InMemoryTaskStore({ events });

    const task = await store.create(baseInput, 'corr-1');

    expect(task.status).toBe('Backlog');
    expect(task.projectId).toBe('proj-1');
    expect(events.publish).toHaveBeenCalledWith(
      'task.created',
      'corr-1',
      expect.objectContaining({ taskId: task.taskId, projectId: 'proj-1' }),
    );
  });

  it('(4) Project -> Task: list() filters by projectId', async () => {
    const store = new InMemoryTaskStore();
    const a = await store.create(baseInput, 'corr-1');
    const b = await store.create({ ...baseInput, projectId: 'proj-2' }, 'corr-1');

    expect(await store.list({ projectId: 'proj-1' })).toEqual([a]);
    expect(await store.list({ projectId: 'proj-2' })).toEqual([b]);
  });

  it('(5) Task -> Agent assignment: assign() sets assignedAgentId, advances Backlog/Ready to Assigned, and emits task.assigned', async () => {
    const events = { publish: vi.fn().mockResolvedValue(undefined) };
    const store = new InMemoryTaskStore({ events });
    const task = await store.create(baseInput, 'corr-1');

    const assigned = await store.assign(task.taskId, 'agent-growth-1', 'corr-2');

    expect(assigned?.assignedAgentId).toBe('agent-growth-1');
    expect(assigned?.status).toBe('Assigned');
    expect(events.publish).toHaveBeenCalledWith(
      'task.assigned',
      'corr-2',
      expect.objectContaining({ taskId: task.taskId, agentId: 'agent-growth-1', projectId: 'proj-1' }),
    );
  });

  it('assign() does not downgrade a Task already past Assigned', async () => {
    const store = new InMemoryTaskStore();
    const task = await store.create(baseInput, 'corr-1');
    await store.updateStatus(task.taskId, 'InProgress', 'corr-1');

    const reassigned = await store.assign(task.taskId, 'agent-growth-2', 'corr-2');
    expect(reassigned?.status).toBe('InProgress');
    expect(reassigned?.assignedAgentId).toBe('agent-growth-2');
  });

  it('assign() on an unknown task returns undefined without emitting', async () => {
    const events = { publish: vi.fn().mockResolvedValue(undefined) };
    const store = new InMemoryTaskStore({ events });
    expect(await store.assign('does-not-exist', 'agent-1', 'corr-1')).toBeUndefined();
    expect(events.publish).not.toHaveBeenCalled();
  });

  it('reassign() changes assignedAgentId, preserves status, and emits task.assigned with previousAgentId', async () => {
    const events = { publish: vi.fn().mockResolvedValue(undefined) };
    const store = new InMemoryTaskStore({ events });
    const task = await store.create(baseInput, 'corr-1');
    await store.assign(task.taskId, 'agent-A', 'corr-1');
    await store.updateStatus(task.taskId, 'InProgress', 'corr-1');
    events.publish.mockClear();

    const reassigned = await store.reassign(task.taskId, 'agent-B', 'corr-2');

    expect(reassigned?.assignedAgentId).toBe('agent-B');
    expect(reassigned?.status).toBe('InProgress');
    expect(events.publish).toHaveBeenCalledWith(
      'task.assigned',
      'corr-2',
      expect.objectContaining({ taskId: task.taskId, agentId: 'agent-B', previousAgentId: 'agent-A' }),
    );
  });

  it('reassign() on an unknown task returns undefined without emitting', async () => {
    const events = { publish: vi.fn().mockResolvedValue(undefined) };
    const store = new InMemoryTaskStore({ events });
    expect(await store.reassign('does-not-exist', 'agent-1', 'corr-1')).toBeUndefined();
    expect(events.publish).not.toHaveBeenCalled();
  });

  it('(6) Task -> Work Package traceability: linkWorkPackage() sets workPackageId', async () => {
    const store = new InMemoryTaskStore();
    const task = await store.create(baseInput, 'corr-1');
    const linked = await store.linkWorkPackage(task.taskId, 'wp-1');
    expect(linked?.workPackageId).toBe('wp-1');
    expect((await store.get(task.taskId))?.workPackageId).toBe('wp-1');
  });

  it('(10) multiple agents on one project: two Tasks on the same project, assigned to different agents, remain independent', async () => {
    const store = new InMemoryTaskStore();
    const a = await store.create(baseInput, 'corr-1');
    const b = await store.create(baseInput, 'corr-1');
    await store.assign(a.taskId, 'agent-A', 'corr-1');
    await store.assign(b.taskId, 'agent-B', 'corr-1');

    expect(await store.list({ assignedAgentId: 'agent-A' })).toHaveLength(1);
    expect(await store.list({ assignedAgentId: 'agent-B' })).toHaveLength(1);
    expect(await store.list({ projectId: 'proj-1' })).toHaveLength(2);
  });

  it('(11) one agent working across sequential tasks: the same agent can be assigned to multiple Tasks over time', async () => {
    const store = new InMemoryTaskStore();
    const a = await store.create(baseInput, 'corr-1');
    const b = await store.create(baseInput, 'corr-1');
    await store.assign(a.taskId, 'agent-A', 'corr-1');
    await store.updateStatus(a.taskId, 'Done', 'corr-1');
    await store.assign(b.taskId, 'agent-A', 'corr-2');

    const forAgent = await store.list({ assignedAgentId: 'agent-A' });
    expect(forAgent.map((t) => t.taskId).sort()).toEqual([a.taskId, b.taskId].sort());
  });

  it('(13) invalid relationships are rejected: create() rejects a Task with no acceptance criteria', async () => {
    const store = new InMemoryTaskStore();
    await expect(store.create({ ...baseInput, acceptanceCriteria: [] }, 'corr-1')).rejects.toThrow();
  });

  it('updateStatus on an unknown task returns undefined without emitting', async () => {
    const events = { publish: vi.fn().mockResolvedValue(undefined) };
    const store = new InMemoryTaskStore({ events });
    expect(await store.updateStatus('does-not-exist', 'Done', 'corr-1')).toBeUndefined();
    expect(events.publish).not.toHaveBeenCalled();
  });
});
