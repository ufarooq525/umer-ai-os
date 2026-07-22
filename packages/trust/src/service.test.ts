import { describe, expect, it, vi } from 'vitest';
import type { RuntimeEventName } from '@umer/contracts';
import { createTrustStack } from './factory.js';

describe('trust runtime', () => {
  it('allows when matching grant exists', async () => {
    const { runtime } = createTrustStack();
    await runtime.registerGrant({
      grantId: 'grant-1',
      principalId: 'eng.app-delivery',
      action: 'workpackage:execute',
      resourceType: 'work_package',
      effect: 'allow',
    });

    const decision = await runtime.authorize(
      {
        principal: { principalId: 'eng.app-delivery', kind: 'specialist_run' },
        action: 'workpackage:execute',
        resourceType: 'work_package',
        resourceId: 'wp-1',
      },
      'corr-1',
    );

    expect(decision.allowed).toBe(true);
  });

  it('denies by default without grant', async () => {
    const { runtime } = createTrustStack();
    const decision = await runtime.authorize(
      {
        principal: { principalId: 'unknown', kind: 'system' },
        action: 'workpackage:execute',
        resourceType: 'work_package',
      },
      'corr-deny',
    );
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('No matching allow grant');
  });

  it('deny grant overrides allow', async () => {
    const { runtime } = createTrustStack();
    await runtime.registerGrant({
      grantId: 'grant-allow',
      principalId: 'eng.app-delivery',
      action: 'workpackage:execute',
      resourceType: 'work_package',
      effect: 'allow',
    });
    await runtime.registerGrant({
      grantId: 'grant-deny',
      principalId: 'eng.app-delivery',
      action: 'workpackage:execute',
      resourceType: 'work_package',
      resourceId: 'wp-blocked',
      effect: 'deny',
    });

    const decision = await runtime.authorize(
      {
        principal: { principalId: 'eng.app-delivery', kind: 'specialist_run' },
        action: 'workpackage:execute',
        resourceType: 'work_package',
        resourceId: 'wp-blocked',
      },
      'corr-deny-override',
    );
    expect(decision.allowed).toBe(false);
  });

  it('emits trust events', async () => {
    const published: RuntimeEventName[] = [];
    const { runtime } = createTrustStack();
    const runtimeWithEvents = new (await import('./service.js')).TrustRuntime({
      store: createTrustStack().store,
      events: {
        publish: vi.fn(async (name: RuntimeEventName) => {
          published.push(name);
        }),
      },
    });
    await runtimeWithEvents.registerGrant({
      grantId: 'grant-evt',
      principalId: 'system',
      action: '*',
      resourceType: '*',
      effect: 'allow',
    });
    await runtimeWithEvents.authorize(
      {
        principal: { principalId: 'system', kind: 'system' },
        action: 'audit:read',
        resourceType: 'audit_log',
      },
      'corr-evt',
    );
    expect(published).toContain('trust.allow');
    expect(runtime).toBeDefined();
  });
});
