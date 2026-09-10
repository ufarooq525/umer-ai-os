import { describe, expect, it, vi } from 'vitest';
import { MySqlGrantStore, type TrustSqlExecutor } from './mysql-store.js';
import type { PermissionGrant } from './types.js';

const SAMPLE_GRANT: PermissionGrant = {
  grantId: 'jarvis-ceo-read',
  principalId: 'ceo',
  action: 'read',
  resourceType: 'jarvis',
  effect: 'allow',
  tenantId: 'tenant-1',
};

describe('MySqlGrantStore', () => {
  it('upserts a grant with the exact column values', async () => {
    const execute = vi.fn<TrustSqlExecutor['execute']>(async () => undefined as never);
    const store = new MySqlGrantStore({ execute: execute as unknown as TrustSqlExecutor['execute'] });

    await store.save(SAMPLE_GRANT);

    expect(execute).toHaveBeenCalledTimes(1);
    const [sql, params] = execute.mock.calls[0]!;
    expect(sql).toContain('INSERT INTO trust_grants');
    expect(sql).toContain('ON DUPLICATE KEY UPDATE');
    expect(params).toEqual(['jarvis-ceo-read', 'ceo', 'read', 'jarvis', null, 'allow', 'tenant-1']);
  });

  it('maps rows back to grants, tolerating null resourceId/tenantId', async () => {
    const execute = vi.fn<TrustSqlExecutor['execute']>(async () => [
      { grant_id: 'g1', principal_id: 'ceo', action: 'execute', resource_type: 'command', resource_id: null, effect: 'allow', tenant_id: null },
    ] as never);
    const store = new MySqlGrantStore({ execute: execute as unknown as TrustSqlExecutor['execute'] });

    const grants = await store.listForPrincipal('ceo');
    expect(grants).toEqual([{ grantId: 'g1', principalId: 'ceo', action: 'execute', resourceType: 'command', resourceId: undefined, effect: 'allow', tenantId: undefined }]);
    expect(execute.mock.calls[0]![0]).toContain('WHERE principal_id = ?');
    expect(execute.mock.calls[0]![1]).toEqual(['ceo']);
  });

  it('lists every grant across all principals', async () => {
    const execute = vi.fn<TrustSqlExecutor['execute']>(async () => [
      { grant_id: 'g1', principal_id: 'ceo', action: 'read', resource_type: 'jarvis', resource_id: null, effect: 'allow', tenant_id: null },
      { grant_id: 'g2', principal_id: 'specialist-1', action: 'read', resource_type: 'jarvis', resource_id: null, effect: 'deny', tenant_id: null },
    ] as never);
    const store = new MySqlGrantStore({ execute: execute as unknown as TrustSqlExecutor['execute'] });

    const grants = await store.list();
    expect(grants).toHaveLength(2);
    expect(grants.map((g) => g.grantId)).toEqual(['g1', 'g2']);
  });

  it('revokes a grant by deleting its row', async () => {
    const execute = vi.fn<TrustSqlExecutor['execute']>(async () => undefined as never);
    const store = new MySqlGrantStore({ execute: execute as unknown as TrustSqlExecutor['execute'] });

    await store.revoke('jarvis-ceo-read');

    expect(execute).toHaveBeenCalledTimes(1);
    const [sql, params] = execute.mock.calls[0]!;
    expect(sql).toContain('DELETE FROM trust_grants WHERE grant_id = ?');
    expect(params).toEqual(['jarvis-ceo-read']);
  });
});
