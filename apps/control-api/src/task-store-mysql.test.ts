import { describe, expect, it, vi } from 'vitest';
import { MySqlTaskStore, type MySqlExecutor } from './task-store-mysql.js';

function taskRow(overrides: Record<string, unknown> = {}) {
  return {
    task_id: 'task-1',
    header_id: 'task-1',
    epic_id: 'epic-1',
    project_id: 'proj-1',
    title: 'Implement feature',
    description: 'Do the thing',
    status: 'Backlog',
    work_class: 'Standard',
    acceptance_criteria_json: JSON.stringify(['it works']),
    capability_ids_json: JSON.stringify([]),
    owner: null,
    assigned_agent_id: null,
    sprint_id: null,
    work_package_id: null,
    metadata_json: JSON.stringify({ labels: {}, annotations: {} }),
    created_at: '2026-09-06T00:00:00.000Z',
    updated_at: '2026-09-06T00:00:00.000Z',
    ...overrides,
  };
}

describe('MySqlTaskStore', () => {
  it('maps a row back to a valid task', async () => {
    const execute = vi.fn<MySqlExecutor['execute']>(async () => [taskRow()] as never);
    const store = new MySqlTaskStore({ db: { execute: execute as unknown as MySqlExecutor['execute'] } });

    const task = await store.get('task-1');

    expect(task).toMatchObject({
      taskId: 'task-1',
      projectId: 'proj-1',
      title: 'Implement feature',
      status: 'Backlog',
      workClass: 'Standard',
      acceptanceCriteria: ['it works'],
    });
    expect(task?.assignedAgentId).toBeUndefined();
  });

  it('returns undefined when no row matches', async () => {
    const execute = vi.fn<MySqlExecutor['execute']>(async () => [] as never);
    const store = new MySqlTaskStore({ db: { execute: execute as unknown as MySqlExecutor['execute'] } });
    expect(await store.get('missing')).toBeUndefined();
  });

  it('creates a real task with a generated id and publishes task.created', async () => {
    const execute = vi.fn<MySqlExecutor['execute']>(async () => undefined as never);
    const publish = vi.fn(async () => undefined);
    const store = new MySqlTaskStore({
      db: { execute: execute as unknown as MySqlExecutor['execute'] },
      events: { publish },
    });

    const task = await store.create(
      { epicId: 'epic-1', projectId: 'proj-1', title: 'New task', description: 'desc', acceptanceCriteria: ['done'] },
      'corr-1',
    );

    expect(task.taskId).toMatch(/^task-/);
    expect(task.status).toBe('Backlog');
    const [sql] = execute.mock.calls[0]!;
    expect(sql).toContain('INSERT INTO work_management_tasks');
    expect(publish).toHaveBeenCalledWith('task.created', 'corr-1', expect.objectContaining({ taskId: task.taskId }));
  });

  it('assign() moves a Backlog task to Assigned and sets assignedAgentId', async () => {
    const execute = vi.fn<MySqlExecutor['execute']>(async () => [taskRow()] as never);
    const store = new MySqlTaskStore({ db: { execute: execute as unknown as MySqlExecutor['execute'] } });

    const updated = await store.assign('task-1', 'agent-1', 'corr-1');

    expect(updated?.status).toBe('Assigned');
    expect(updated?.assignedAgentId).toBe('agent-1');
  });

  it('assign() returns undefined for an unknown task without writing', async () => {
    const execute = vi.fn<MySqlExecutor['execute']>(async () => [] as never);
    const store = new MySqlTaskStore({ db: { execute: execute as unknown as MySqlExecutor['execute'] } });

    const result = await store.assign('missing', 'agent-1', 'corr-1');

    expect(result).toBeUndefined();
    expect(execute).toHaveBeenCalledTimes(1); // only the SELECT from get(), no INSERT
  });

  it('reassign() records the previous agent in the published event', async () => {
    const execute = vi.fn<MySqlExecutor['execute']>(async () => [taskRow({ assigned_agent_id: 'agent-1' })] as never);
    const publish = vi.fn(async () => undefined);
    const store = new MySqlTaskStore({
      db: { execute: execute as unknown as MySqlExecutor['execute'] },
      events: { publish },
    });

    await store.reassign('task-1', 'agent-2', 'corr-1');

    expect(publish).toHaveBeenCalledWith(
      'task.assigned',
      'corr-1',
      expect.objectContaining({ agentId: 'agent-2', previousAgentId: 'agent-1' }),
    );
  });

  it('filters list() by projectId, status, and assignedAgentId together', async () => {
    const execute = vi.fn<MySqlExecutor['execute']>(async () => [] as never);
    const store = new MySqlTaskStore({ db: { execute: execute as unknown as MySqlExecutor['execute'] } });

    await store.list({ projectId: 'proj-1', status: 'InProgress', assignedAgentId: 'agent-1' });

    const [sql, params] = execute.mock.calls[0]!;
    expect(sql).toContain('WHERE status = ? AND assigned_agent_id = ? AND project_id = ?');
    expect(params).toEqual(['InProgress', 'agent-1', 'proj-1']);
  });

  it('linkWorkPackage sets workPackageId without publishing an event', async () => {
    const execute = vi.fn<MySqlExecutor['execute']>(async () => [taskRow()] as never);
    const publish = vi.fn(async () => undefined);
    const store = new MySqlTaskStore({
      db: { execute: execute as unknown as MySqlExecutor['execute'] },
      events: { publish },
    });

    const updated = await store.linkWorkPackage('task-1', 'wp-1');

    expect(updated?.workPackageId).toBe('wp-1');
    expect(publish).not.toHaveBeenCalled();
  });
});
