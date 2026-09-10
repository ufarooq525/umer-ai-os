import { describe, expect, it } from 'vitest';
import { InMemoryGrantStore } from './store.js';
import type { PermissionGrant } from './types.js';

const GRANT: PermissionGrant = { grantId: 'g1', principalId: 'ceo', action: 'read', resourceType: 'jarvis', effect: 'allow' };

describe('InMemoryGrantStore', () => {
  it('saves and lists grants for a principal', async () => {
    const store = new InMemoryGrantStore();
    await store.save(GRANT);
    expect(await store.listForPrincipal('ceo')).toEqual([GRANT]);
    expect(await store.listForPrincipal('someone-else')).toEqual([]);
  });

  it('lists every grant across all principals', async () => {
    const store = new InMemoryGrantStore();
    await store.save(GRANT);
    await store.save({ ...GRANT, grantId: 'g2', principalId: 'alice' });
    expect((await store.list()).map((g) => g.grantId).sort()).toEqual(['g1', 'g2']);
  });

  it('revokes a grant by id, leaving other grants for the same principal intact', async () => {
    const store = new InMemoryGrantStore();
    await store.save(GRANT);
    await store.save({ ...GRANT, grantId: 'g2', action: 'execute', resourceType: 'command' });

    await store.revoke('g1');

    const remaining = await store.listForPrincipal('ceo');
    expect(remaining.map((g) => g.grantId)).toEqual(['g2']);
  });

  it('revoking an unknown grant id is a no-op, not an error', async () => {
    const store = new InMemoryGrantStore();
    await expect(store.revoke('no-such-grant')).resolves.toBeUndefined();
  });
});
