import { describe, expect, it, vi } from 'vitest';
import { MySqlWorkPackageStore, type MySqlExecutor } from './work-package-mysql-store.js';
import { createTestWorkPackage } from './test-utils.js';

describe('MySqlWorkPackageStore', () => {
  it('maps a row (JSON columns as strings, as mysql2 returns them) back to a valid record', async () => {
    const execute = vi.fn<MySqlExecutor['execute']>(async () => [] as never);
    execute.mockResolvedValueOnce([
      {
        work_package_id: 'wp-1',
        header_id: 'hdr-wp-1',
        exec_id: 'EXEC-001',
        stage: 'Development',
        status: 'Running',
        specialist_id: 'eng.spec.1',
        specialist_spec_version: '1.0.0',
        specialist_spec_hash: 'abc123',
        task_ids_json: JSON.stringify(['task-1']),
        capability_ids_json: JSON.stringify([]),
        context_handle: 'ctx-1',
        tool_allowlist_json: JSON.stringify([]),
        resource_envelope_json: JSON.stringify({ parallelism: 1 }),
        attempt: 1,
        parent_work_package_id: null,
        correlation_id: 'corr-wp-1',
        metadata_json: JSON.stringify({ labels: {}, annotations: {} }),
        created_at: '2026-09-06T00:00:00.000Z',
        updated_at: '2026-09-06T00:00:00.000Z',
        queued_at: '2026-09-06T00:00:00.000Z',
        dispatched_at: '2026-09-06T00:00:01.000Z',
        started_at: '2026-09-06T00:00:02.000Z',
        last_error: null,
      },
    ] as never);

    const store = new MySqlWorkPackageStore({ db: { execute: execute as unknown as MySqlExecutor['execute'] } });
    const record = await store.get('wp-1');

    expect(record?.workPackage).toMatchObject({
      workPackageId: 'wp-1',
      execId: 'EXEC-001',
      status: 'Running',
      taskIds: ['task-1'],
    });
    expect(record?.startedAt).toBe('2026-09-06T00:00:02.000Z');
    expect(record?.lastError).toBeUndefined();
  });

  it('maps a row where the driver already parsed JSON columns to objects', async () => {
    const execute = vi.fn<MySqlExecutor['execute']>(async () => [] as never);
    execute.mockResolvedValueOnce([
      {
        work_package_id: 'wp-2',
        header_id: 'hdr-wp-2',
        exec_id: 'EXEC-002',
        stage: 'Development',
        status: 'Failed',
        specialist_id: 'eng.spec.1',
        specialist_spec_version: '1.0.0',
        specialist_spec_hash: 'abc123',
        task_ids_json: ['task-1'],
        capability_ids_json: [],
        context_handle: 'ctx-1',
        tool_allowlist_json: [],
        resource_envelope_json: { parallelism: 1 },
        attempt: 2,
        parent_work_package_id: null,
        correlation_id: null,
        metadata_json: { labels: {}, annotations: {} },
        created_at: '2026-09-06T00:00:00.000Z',
        updated_at: '2026-09-06T00:00:00.000Z',
        queued_at: null,
        dispatched_at: null,
        started_at: null,
        last_error: 'boom',
      },
    ] as never);

    const store = new MySqlWorkPackageStore({ db: { execute: execute as unknown as MySqlExecutor['execute'] } });
    const record = await store.get('wp-2');
    expect(record?.lastError).toBe('boom');
    expect(record?.workPackage.attempt).toBe(2);
    expect(record?.workPackage.correlationId).toBeUndefined();
  });

  it('returns undefined when no row matches', async () => {
    const execute = vi.fn<MySqlExecutor['execute']>(async () => [] as never);
    const store = new MySqlWorkPackageStore({ db: { execute: execute as unknown as MySqlExecutor['execute'] } });
    expect(await store.get('missing')).toBeUndefined();
  });

  it('upserts a record with the exact column values, encoding structured fields as JSON', async () => {
    const execute = vi.fn<MySqlExecutor['execute']>(async () => undefined as never);
    const store = new MySqlWorkPackageStore({ db: { execute: execute as unknown as MySqlExecutor['execute'] } });

    const workPackage = createTestWorkPackage({ status: 'Queued' });
    await store.save({ workPackage, queuedAt: '2026-07-22T00:00:00.000Z' });

    expect(execute).toHaveBeenCalledTimes(1);
    const [sql, params] = execute.mock.calls[0]!;
    expect(sql).toContain('INSERT INTO orchestration_work_packages');
    expect(sql).toContain('ON DUPLICATE KEY UPDATE');
    expect(params).toContain('wp-1');
    expect(params).toContain(JSON.stringify(['task-1']));
    expect(params).toContain('2026-07-22 00:00:00.000');
  });

  it('filters listByStatus to only the requested status', async () => {
    const execute = vi.fn<MySqlExecutor['execute']>(async () => [] as never);
    const store = new MySqlWorkPackageStore({ db: { execute: execute as unknown as MySqlExecutor['execute'] } });

    await store.listByStatus('Running');

    const [sql, params] = execute.mock.calls[0]!;
    expect(sql).toContain('WHERE status = ?');
    expect(params).toEqual(['Running']);
  });
});
