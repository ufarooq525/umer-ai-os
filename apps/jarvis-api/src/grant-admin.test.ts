import { describe, expect, it } from 'vitest';
import { InMemoryGrantStore, TrustRuntime } from '@umer/trust';
import { requireAdmin, listGrants, createGrant, revokeGrant, GrantAdminError } from './grant-admin.js';

describe('requireAdmin', () => {
  it('fails closed for a principal with no admin grant, even if they have other grants', async () => {
    const store = new InMemoryGrantStore();
    const trust = new TrustRuntime({ store });
    await trust.registerGrant({ grantId: 'g1', principalId: 'alice', action: 'read', resourceType: 'jarvis', effect: 'allow' });

    await expect(requireAdmin(trust, { principalId: 'alice', kind: 'human' }, 'corr-1')).rejects.toBeInstanceOf(GrantAdminError);
  });

  it('allows a principal with an explicit admin/trust grant', async () => {
    const store = new InMemoryGrantStore();
    const trust = new TrustRuntime({ store });
    await trust.registerGrant({ grantId: 'g1', principalId: 'ceo', action: 'admin', resourceType: 'trust', effect: 'allow' });

    await expect(requireAdmin(trust, { principalId: 'ceo', kind: 'human' }, 'corr-1')).resolves.toBeUndefined();
  });
});

describe('createGrant / listGrants / revokeGrant', () => {
  it('creates a grant with a fresh grantId and persists it', async () => {
    const store = new InMemoryGrantStore();
    const grant = await createGrant(store, { principalId: 'alice', action: 'read', resourceType: 'jarvis' });

    expect(grant.principalId).toBe('alice');
    expect(grant.effect).toBe('allow');
    expect(grant.grantId).toMatch(/^admin-/);
    expect(await store.listForPrincipal('alice')).toEqual([grant]);
  });

  it('rejects a grant missing required fields instead of silently creating a broken one', async () => {
    const store = new InMemoryGrantStore();
    await expect(createGrant(store, { principalId: '', action: 'read', resourceType: 'jarvis' })).rejects.toBeInstanceOf(GrantAdminError);
    await expect(createGrant(store, { principalId: 'alice', action: '', resourceType: 'jarvis' })).rejects.toBeInstanceOf(GrantAdminError);
    await expect(createGrant(store, { principalId: 'alice', action: 'read', resourceType: '' })).rejects.toBeInstanceOf(GrantAdminError);
  });

  it('lists all grants when no principalId filter is given, and scoped grants when it is', async () => {
    const store = new InMemoryGrantStore();
    await createGrant(store, { principalId: 'alice', action: 'read', resourceType: 'jarvis' });
    await createGrant(store, { principalId: 'bob', action: 'read', resourceType: 'jarvis' });

    expect(await listGrants(store)).toHaveLength(2);
    expect(await listGrants(store, 'alice')).toHaveLength(1);
    expect(await listGrants(store, 'nobody')).toHaveLength(0);
  });

  it('revokes a grant so it no longer authorizes anything', async () => {
    const store = new InMemoryGrantStore();
    const trust = new TrustRuntime({ store });
    const grant = await createGrant(store, { principalId: 'alice', action: 'read', resourceType: 'jarvis' });

    expect((await trust.authorize({ principal: { principalId: 'alice', kind: 'human' }, action: 'read', resourceType: 'jarvis' }, 'corr-1')).allowed).toBe(true);

    await revokeGrant(store, grant.grantId);

    expect((await trust.authorize({ principal: { principalId: 'alice', kind: 'human' }, action: 'read', resourceType: 'jarvis' }, 'corr-2')).allowed).toBe(false);
  });

  it('rejects revoking with an empty grantId', async () => {
    const store = new InMemoryGrantStore();
    await expect(revokeGrant(store, '')).rejects.toBeInstanceOf(GrantAdminError);
  });
});
