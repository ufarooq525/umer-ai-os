import type { PermissionGrant } from './types.js';

export type GrantStore = {
  save(grant: PermissionGrant): Promise<void>;
  listForPrincipal(principalId: string): Promise<PermissionGrant[]>;
  list(): Promise<PermissionGrant[]>;
};

export class InMemoryGrantStore implements GrantStore {
  private readonly grants = new Map<string, PermissionGrant>();

  async save(grant: PermissionGrant): Promise<void> {
    this.grants.set(grant.grantId, structuredClone(grant));
  }

  async listForPrincipal(principalId: string): Promise<PermissionGrant[]> {
    return [...this.grants.values()].filter((grant) => grant.principalId === principalId);
  }

  async list(): Promise<PermissionGrant[]> {
    return [...this.grants.values()];
  }

  clear(): void {
    this.grants.clear();
  }
}
