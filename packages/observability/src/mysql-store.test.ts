import { describe, expect, it, vi } from 'vitest';
import { SCHEMA_VERSION, type EventEnvelope, type RuntimeEventName } from '@umer/contracts';
import {
  MySqlAgentRunReadModelStore,
  MySqlAgentRegistryStore,
  type MySqlExecutor,
} from './mysql-store.js';

let seq = 0;
function makeEvent(name: RuntimeEventName, payload: Record<string, unknown>): EventEnvelope {
  seq += 1;
  return {
    eventId: `evt-${seq}`,
    schemaVersion: SCHEMA_VERSION,
    name,
    occurredAt: '2026-09-06T00:00:00.000Z',
    correlationId: 'corr-1',
    producer: 'agent-worker',
    payload,
  };
}

function agentRunRow(overrides: Record<string, unknown> = {}) {
  return {
    work_package_id: 'wp-1',
    run_id: 'wp-1:corr-1',
    exec_id: 'EXEC-1',
    specialist_id: 'growth.opportunity-research',
    agent_id: 'agent-1',
    task_ids_json: JSON.stringify(['task-1']),
    correlation_id: 'corr-1',
    status: 'running',
    current_action: 'waiting_on_model',
    current_tool: null,
    current_tool_input_json: null,
    started_at: '2026-09-06T00:00:00.000Z',
    updated_at: '2026-09-06T00:00:00.000Z',
    finished_at: null,
    tool_calls_json: JSON.stringify([]),
    decisions_json: JSON.stringify([]),
    action_log_json: JSON.stringify([]),
    failures_json: JSON.stringify([]),
    artifact_id: null,
    summary: null,
    error_message: null,
    ...overrides,
  };
}

function agentRow(overrides: Record<string, unknown> = {}) {
  return {
    agent_id: 'agent-1',
    specialist_id: 'growth.opportunity-research',
    name: 'Growth Researcher',
    department: 'Growth',
    capability_ids_json: JSON.stringify(['cap.growth.discovery']),
    status: 'active',
    last_seen_at: '2026-09-06T00:00:00.000Z',
    current_work_package_id: 'wp-1',
    current_task_ids_json: JSON.stringify(['task-1']),
    current_agent_run_id: 'wp-1:corr-1',
    correlation_id: 'corr-1',
    ...overrides,
  };
}

describe('MySqlAgentRunReadModelStore', () => {
  it('maps a row back to a valid snapshot', async () => {
    const execute = vi.fn<MySqlExecutor['execute']>(async () => [agentRunRow()] as never);
    const store = new MySqlAgentRunReadModelStore({ db: { execute: execute as unknown as MySqlExecutor['execute'] } });

    const snapshot = await store.get('wp-1');

    expect(snapshot).toMatchObject({
      workPackageId: 'wp-1',
      status: 'running',
      specialistId: 'growth.opportunity-research',
      taskIds: ['task-1'],
    });
  });

  it('returns undefined when no row matches', async () => {
    const execute = vi.fn<MySqlExecutor['execute']>(async () => [] as never);
    const store = new MySqlAgentRunReadModelStore({ db: { execute: execute as unknown as MySqlExecutor['execute'] } });
    expect(await store.get('missing')).toBeUndefined();
  });

  it('project() folds an event via the shared reducer and upserts the result', async () => {
    const execute = vi.fn<MySqlExecutor['execute']>(async () => [] as never); // no existing row
    const store = new MySqlAgentRunReadModelStore({ db: { execute: execute as unknown as MySqlExecutor['execute'] } });

    const event = makeEvent('agent.run.started', { workPackageId: 'wp-1', specialistId: 'growth.opportunity-research' });

    const result = await store.project(event);

    expect(result?.status).toBe('running');
    const insertCall = execute.mock.calls.find(([sql]) => sql.includes('INSERT INTO'));
    expect(insertCall).toBeDefined();
  });

  it('project() ignores an event with no workPackageId, without writing', async () => {
    const execute = vi.fn<MySqlExecutor['execute']>(async () => [] as never);
    const store = new MySqlAgentRunReadModelStore({ db: { execute: execute as unknown as MySqlExecutor['execute'] } });

    const event = makeEvent('agent.run.started', {});

    const result = await store.project(event);

    expect(result).toBeUndefined();
    expect(execute).not.toHaveBeenCalled();
  });

  it('filters list() by status', async () => {
    const execute = vi.fn<MySqlExecutor['execute']>(async () => [] as never);
    const store = new MySqlAgentRunReadModelStore({ db: { execute: execute as unknown as MySqlExecutor['execute'] } });

    await store.list({ status: 'failed' });

    const [sql, params] = execute.mock.calls[0]!;
    expect(sql).toContain('WHERE status = ?');
    expect(params).toEqual(['failed']);
  });
});

describe('MySqlAgentRegistryStore', () => {
  it('maps a row back to a valid agent snapshot', async () => {
    const execute = vi.fn<MySqlExecutor['execute']>(async () => [agentRow()] as never);
    const store = new MySqlAgentRegistryStore({ db: { execute: execute as unknown as MySqlExecutor['execute'] } });

    const agent = await store.get('agent-1');

    expect(agent).toMatchObject({
      agentId: 'agent-1',
      specialistId: 'growth.opportunity-research',
      name: 'Growth Researcher',
      status: 'active',
      capabilityIds: ['cap.growth.discovery'],
    });
  });

  it('project() folds agent.run.completed and clears current-work fields', async () => {
    const execute = vi.fn<MySqlExecutor['execute']>(async () => [agentRow()] as never);
    const store = new MySqlAgentRegistryStore({ db: { execute: execute as unknown as MySqlExecutor['execute'] } });

    const event = makeEvent('agent.run.completed', { agentId: 'agent-1', workPackageId: 'wp-1' });

    const result = await store.project(event);

    expect(result?.status).toBe('idle');
    expect(result?.currentWorkPackageId).toBeUndefined();
  });

  it('filters list() by department and specialistId together', async () => {
    const execute = vi.fn<MySqlExecutor['execute']>(async () => [] as never);
    const store = new MySqlAgentRegistryStore({ db: { execute: execute as unknown as MySqlExecutor['execute'] } });

    await store.list({ department: 'Growth', specialistId: 'growth.opportunity-research' });

    const [sql, params] = execute.mock.calls[0]!;
    expect(sql).toContain('WHERE department = ? AND specialist_id = ?');
    expect(params).toEqual(['Growth', 'growth.opportunity-research']);
  });
});
