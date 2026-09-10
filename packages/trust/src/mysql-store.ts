import type { PermissionGrant } from './types.js';
import type { GrantStore } from './store.js';

export type TrustSqlExecutor = {
  execute<T = unknown>(sql: string, params?: readonly unknown[]): Promise<T>;
};

type GrantRow = {
  grant_id: string;
  principal_id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  effect: string;
  tenant_id: string | null;
};

function toGrant(row: GrantRow): PermissionGrant {
  return {
    grantId: row.grant_id,
    principalId: row.principal_id,
    action: row.action,
    resourceType: row.resource_type,
    resourceId: row.resource_id ?? undefined,
    effect: row.effect as PermissionGrant['effect'],
    tenantId: row.tenant_id ?? undefined,
  };
}

/**
 * Durable MySQL-backed Trust grant store. Replaces re-deriving grants from
 * startup environment variables on every restart — grants persist across
 * restarts and can be administered independently of process configuration.
 */
export class MySqlGrantStore implements GrantStore {
  constructor(private readonly db: TrustSqlExecutor) {}

  async save(grant: PermissionGrant): Promise<void> {
    await this.db.execute(
      `INSERT INTO trust_grants (grant_id, principal_id, action, resource_type, resource_id, effect, tenant_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3))
       ON DUPLICATE KEY UPDATE
        principal_id=VALUES(principal_id), action=VALUES(action), resource_type=VALUES(resource_type),
        resource_id=VALUES(resource_id), effect=VALUES(effect), tenant_id=VALUES(tenant_id)`,
      [grant.grantId, grant.principalId, grant.action, grant.resourceType, grant.resourceId ?? null, grant.effect, grant.tenantId ?? null],
    );
  }

  async listForPrincipal(principalId: string): Promise<PermissionGrant[]> {
    const rows = await this.db.execute<GrantRow[]>(
      'SELECT grant_id, principal_id, action, resource_type, resource_id, effect, tenant_id FROM trust_grants WHERE principal_id = ?',
      [principalId],
    );
    return rows.map(toGrant);
  }

  async list(): Promise<PermissionGrant[]> {
    const rows = await this.db.execute<GrantRow[]>('SELECT grant_id, principal_id, action, resource_type, resource_id, effect, tenant_id FROM trust_grants');
    return rows.map(toGrant);
  }

  async revoke(grantId: string): Promise<void> {
    await this.db.execute('DELETE FROM trust_grants WHERE grant_id = ?', [grantId]);
  }
}
