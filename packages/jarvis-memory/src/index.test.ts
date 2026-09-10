import { describe, expect, it } from 'vitest';
import { createMemoryStack } from '@umer/memory-access';
import { createJarvisMemory } from './index.js';

describe('createJarvisMemory — tenant propagation', () => {
  it('writes a remembered turn under the bound principal when no per-call principal is supplied', async () => {
    const stack = createMemoryStack();
    const memory = createJarvisMemory({ service: stack.service, principal: { principalId: 'jarvis-ceo', grantedScopes: ['read_write'], tenantId: 'tenant-default' } });

    await memory.rememberTurn('session-1', 'hello', 'hi there', 'corr-1');

    const stored = await stack.store.list();
    expect(stored).toHaveLength(1);
    expect(stored[0]!.tenantId).toBe('tenant-default');
  });

  it('writes a remembered turn under the per-request authenticated principal, not the bound default', async () => {
    const stack = createMemoryStack();
    const memory = createJarvisMemory({ service: stack.service, principal: { principalId: 'jarvis-ceo', grantedScopes: ['read_write'], tenantId: 'tenant-default' } });

    await memory.rememberTurn('session-1', 'hello', 'hi there', 'corr-1', { principalId: 'alice', grantedScopes: ['read_write'], tenantId: 'tenant-alice' });

    const stored = await stack.store.list();
    expect(stored).toHaveLength(1);
    expect(stored[0]!.tenantId).toBe('tenant-alice');
  });

  it('never persists a turn for a per-call principal that lacks write scope, even if the bound default has it', async () => {
    const stack = createMemoryStack();
    const memory = createJarvisMemory({ service: stack.service, principal: { principalId: 'jarvis-ceo', grantedScopes: ['read_write'] } });

    await memory.rememberTurn('session-1', 'hello', 'hi there', 'corr-1', { principalId: 'read-only-user', grantedScopes: ['read'] });

    expect(await stack.store.list()).toHaveLength(0);
  });

  it('scopes retrieval to the per-call principal tenant, not the bound default tenant', async () => {
    const stack = createMemoryStack();
    const memory = createJarvisMemory({ service: stack.service, principal: { principalId: 'jarvis-ceo', grantedScopes: ['read_write'], tenantId: 'tenant-default' } });
    await memory.rememberTurn('session-1', 'hello', 'hi there', 'corr-1', { principalId: 'alice', grantedScopes: ['read_write'], tenantId: 'tenant-alice' });

    const bundle = await memory.retrieve('hello', { principal: { principalId: 'alice', grantedScopes: ['read'], tenantId: 'tenant-alice' } });
    expect(bundle.citations.length).toBeGreaterThan(0);

    const otherTenant = await memory.retrieve('hello', { principal: { principalId: 'bob', grantedScopes: ['read'], tenantId: 'tenant-bob' } });
    expect(otherTenant.citations).toHaveLength(0);
  });

  it('deletes under the per-call principal, denying a principal from a different tenant', async () => {
    const stack = createMemoryStack();
    const memory = createJarvisMemory({ service: stack.service, principal: { principalId: 'jarvis-ceo', grantedScopes: ['read_write'], tenantId: 'tenant-default' } });
    await memory.rememberTurn('session-1', 'hello', 'hi there', 'corr-1', { principalId: 'alice', grantedScopes: ['read_write'], tenantId: 'tenant-alice' });
    const [memoryId] = (await stack.store.list()).map((m) => m.memoryId);

    await expect(memory.delete(memoryId!, 'corr-2', { principalId: 'bob', grantedScopes: ['read_write'], tenantId: 'tenant-bob' })).rejects.toThrow();
    expect(await stack.store.list()).toHaveLength(1);

    await memory.delete(memoryId!, 'corr-3', { principalId: 'alice', grantedScopes: ['read_write'], tenantId: 'tenant-alice' });
    expect(await stack.store.list()).toHaveLength(0);
  });
});
