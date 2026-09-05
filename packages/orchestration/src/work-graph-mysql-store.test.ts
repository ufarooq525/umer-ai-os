import { describe, expect, it, vi } from 'vitest';
import { MySqlWorkGraphStore, type MySqlExecutor } from './work-graph-mysql-store.js';
import { createTestWorkGraphNode } from './test-utils.js';

describe('MySqlWorkGraphStore', () => {
  it('maps a node row (JSON metadata as string, as mysql2 returns it) back to a valid contract', async () => {
    const execute = vi.fn<MySqlExecutor['execute']>(async () => [] as never);
    execute.mockResolvedValueOnce([
      {
        header_id: 'hdr-requirements',
        project_id: 'proj-1',
        node_id: 'requirements',
        type: 'Requirements',
        status: 'Ready',
        title: 'Requirements',
        work_package_id: null,
        metadata_json: JSON.stringify({ labels: {}, annotations: {} }),
        created_at: '2026-09-06T00:00:00.000Z',
        updated_at: '2026-09-06T00:00:00.000Z',
      },
    ] as never);

    const store = new MySqlWorkGraphStore({ db: { execute: execute as unknown as MySqlExecutor['execute'] } });
    const nodes = await store.listNodes('proj-1');

    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({
      nodeId: 'requirements',
      projectId: 'proj-1',
      type: 'Requirements',
      status: 'Ready',
    });
    expect(nodes[0]!.workPackageId).toBeUndefined();
  });

  it('maps a node row where the driver already parsed the JSON column to an object', async () => {
    const execute = vi.fn<MySqlExecutor['execute']>(async () => [] as never);
    execute.mockResolvedValueOnce([
      {
        header_id: 'hdr-a',
        project_id: 'proj-1',
        node_id: 'a',
        type: 'Product',
        status: 'Blocked',
        title: 'Product',
        work_package_id: 'wp-1',
        metadata_json: { labels: {}, annotations: {} },
        created_at: '2026-09-06T00:00:00.000Z',
        updated_at: '2026-09-06T00:00:00.000Z',
      },
    ] as never);

    const store = new MySqlWorkGraphStore({ db: { execute: execute as unknown as MySqlExecutor['execute'] } });
    const nodes = await store.listNodes('proj-1');
    expect(nodes[0]!.workPackageId).toBe('wp-1');
  });

  it('upserts a node with the exact column values, encoding metadata as JSON', async () => {
    const execute = vi.fn<MySqlExecutor['execute']>(async () => undefined as never);
    const store = new MySqlWorkGraphStore({ db: { execute: execute as unknown as MySqlExecutor['execute'] } });

    await store.saveNode(
      createTestWorkGraphNode({
        nodeId: 'a',
        projectId: 'proj-1',
        type: 'Requirements',
        status: 'Ready',
        title: 'Requirements',
        createdAt: '2026-09-06T00:00:00.000Z',
        updatedAt: '2026-09-06T00:00:00.000Z',
      }),
    );

    expect(execute).toHaveBeenCalledTimes(1);
    const [sql, params] = execute.mock.calls[0]!;
    expect(sql).toContain('INSERT INTO work_graph_nodes');
    expect(sql).toContain('ON DUPLICATE KEY UPDATE');
    expect(params).toEqual([
      'hdr-a',
      'proj-1',
      'a',
      'Requirements',
      'Ready',
      'Requirements',
      null,
      JSON.stringify({ labels: {}, annotations: {} }),
      '2026-09-06 00:00:00.000',
      '2026-09-06 00:00:00.000',
    ]);
  });

  it('resolves the owning project id for a Work Package via findProjectIdByWorkPackage', async () => {
    const execute = vi.fn<MySqlExecutor['execute']>(async () => [{ project_id: 'proj-7' }] as never);
    const store = new MySqlWorkGraphStore({ db: { execute: execute as unknown as MySqlExecutor['execute'] } });

    const projectId = await store.findProjectIdByWorkPackage('wp-7');
    expect(projectId).toBe('proj-7');
    expect(execute.mock.calls[0]![1]).toEqual(['wp-7']);
  });

  it('returns undefined when no node has that Work Package attached', async () => {
    const execute = vi.fn<MySqlExecutor['execute']>(async () => [] as never);
    const store = new MySqlWorkGraphStore({ db: { execute: execute as unknown as MySqlExecutor['execute'] } });
    expect(await store.findProjectIdByWorkPackage('wp-missing')).toBeUndefined();
  });
});
