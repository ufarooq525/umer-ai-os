import { describe, expect, it, vi } from 'vitest';
import { MySqlGateWaitStore, type MySqlExecutor } from './mysql-store.js';
import type { GateWaitRecord } from './types.js';

const SAMPLE_RECORD: GateWaitRecord = {
  waitId: 'wait-1',
  gateId: 'gate-wp-1',
  execId: 'EXEC-001',
  workPackageId: 'wp-1',
  artifactId: 'art-1',
  stageFrom: 'Execution',
  stageTo: 'Review',
  status: 'waiting',
  requiredApprovers: ['human.approver'],
  recordedApprovers: [],
  humanRequired: true,
  requestedAt: '2026-09-06T00:00:00.000Z',
};

describe('MySqlGateWaitStore', () => {
  it('maps a row (JSON columns as strings, as mysql2 returns them) back to a valid record', async () => {
    const execute = vi.fn<MySqlExecutor['execute']>(async () => [] as never);
    execute.mockResolvedValueOnce([
      {
        wait_id: 'wait-1',
        gate_id: 'gate-wp-1',
        exec_id: 'EXEC-001',
        work_package_id: 'wp-1',
        artifact_id: 'art-1',
        stage_from: 'Execution',
        stage_to: 'Review',
        status: 'waiting',
        required_approvers_json: JSON.stringify(['human.approver']),
        recorded_approvers_json: JSON.stringify([]),
        human_required: 1,
        requested_at: '2026-09-06T00:00:00.000Z',
        resolved_at: null,
        rationale: null,
      },
    ] as never);

    const store = new MySqlGateWaitStore({ db: { execute: execute as unknown as MySqlExecutor['execute'] } });
    const record = await store.get('wait-1');

    expect(record).toMatchObject({
      waitId: 'wait-1',
      gateId: 'gate-wp-1',
      status: 'waiting',
      requiredApprovers: ['human.approver'],
      humanRequired: true,
    });
    expect(record?.resolvedAt).toBeUndefined();
    expect(record?.rationale).toBeUndefined();
  });

  it('maps a row where the driver already parsed JSON columns to arrays', async () => {
    const execute = vi.fn<MySqlExecutor['execute']>(async () => [] as never);
    execute.mockResolvedValueOnce([
      {
        wait_id: 'wait-2',
        gate_id: 'gate-wp-2',
        exec_id: 'EXEC-002',
        work_package_id: 'wp-2',
        artifact_id: null,
        stage_from: 'Execution',
        stage_to: 'Review',
        status: 'passed',
        required_approvers_json: ['human.approver'],
        recorded_approvers_json: ['human.approver'],
        human_required: 0,
        requested_at: '2026-09-06T00:00:00.000Z',
        resolved_at: '2026-09-06T01:00:00.000Z',
        rationale: 'looks good',
      },
    ] as never);

    const store = new MySqlGateWaitStore({ db: { execute: execute as unknown as MySqlExecutor['execute'] } });
    const record = await store.get('wait-2');

    expect(record?.humanRequired).toBe(false);
    expect(record?.resolvedAt).toBe('2026-09-06T01:00:00.000Z');
    expect(record?.rationale).toBe('looks good');
  });

  it('returns undefined when no row matches', async () => {
    const execute = vi.fn<MySqlExecutor['execute']>(async () => [] as never);
    const store = new MySqlGateWaitStore({ db: { execute: execute as unknown as MySqlExecutor['execute'] } });
    expect(await store.get('missing')).toBeUndefined();
  });

  it('upserts a record with the exact column values, encoding arrays as JSON', async () => {
    const execute = vi.fn<MySqlExecutor['execute']>(async () => undefined as never);
    const store = new MySqlGateWaitStore({ db: { execute: execute as unknown as MySqlExecutor['execute'] } });

    await store.save(SAMPLE_RECORD);

    expect(execute).toHaveBeenCalledTimes(1);
    const [sql, params] = execute.mock.calls[0]!;
    expect(sql).toContain('INSERT INTO control_plane_gate_waits');
    expect(sql).toContain('ON DUPLICATE KEY UPDATE');
    expect(params).toEqual([
      'wait-1',
      'gate-wp-1',
      'EXEC-001',
      'wp-1',
      'art-1',
      'Execution',
      'Review',
      'waiting',
      JSON.stringify(['human.approver']),
      JSON.stringify([]),
      1,
      '2026-09-06 00:00:00.000',
      null,
      null,
    ]);
  });

  it('filters listPending to only status = waiting, ordered oldest first', async () => {
    const execute = vi.fn<MySqlExecutor['execute']>(async () => [] as never);
    const store = new MySqlGateWaitStore({ db: { execute: execute as unknown as MySqlExecutor['execute'] } });

    await store.listPending();

    const [sql] = execute.mock.calls[0]!;
    expect(sql).toContain("status = 'waiting'");
    expect(sql).toContain('ORDER BY requested_at ASC');
  });
});
