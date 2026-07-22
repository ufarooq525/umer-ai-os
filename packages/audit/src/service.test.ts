import { describe, expect, it } from 'vitest';
import { createAuditStack } from './factory.js';
import { computeAuditEntryHash, GENESIS_HASH } from './hash.js';

describe('audit service', () => {
  it('appends chained audit records', async () => {
    const { service, store } = createAuditStack();
    await service.append(
      {
        action: 'agent.run.completed',
        actor: 'eng.app-delivery',
        resourceType: 'work_package',
        resourceId: 'wp-1',
        outcome: 'success',
        correlationId: 'corr-1',
      },
      'corr-1',
    );
    await service.append(
      {
        action: 'artifact.sealed',
        actor: 'eng.app-delivery',
        resourceType: 'artifact',
        resourceId: 'art-1',
        outcome: 'success',
        correlationId: 'corr-1',
      },
      'corr-1',
    );

    const entries = store.getEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0]?.previousHash).toBe(GENESIS_HASH);
    expect(entries[1]?.previousHash).toBe(entries[0]?.recordHash);
  });

  it('verifies integrity of the chain', async () => {
    const { service } = createAuditStack();
    await service.append(
      {
        action: 'trust.allow',
        actor: 'system',
        resourceType: 'work_package',
        resourceId: 'wp-1',
        outcome: 'success',
      },
      'corr-audit',
    );
    const verification = await service.verifyIntegrity();
    expect(verification.valid).toBe(true);
    expect(verification.recordCount).toBe(1);
  });

  it('detects tampered chain', async () => {
    const { service, store } = createAuditStack();
    await service.append(
      {
        action: 'artifact.sealed',
        actor: 'eng.app-delivery',
        resourceType: 'artifact',
        resourceId: 'art-1',
        outcome: 'success',
      },
      'corr-tamper',
    );
    const entry = store.getEntries()[0]!;
    entry.recordHash = 'tampered';
    const verification = await service.verifyIntegrity();
    expect(verification.valid).toBe(false);
    expect(computeAuditEntryHash(GENESIS_HASH, entry.record)).not.toBe('tampered');
  });

  it('queries by correlation id', async () => {
    const { service } = createAuditStack();
    await service.append(
      {
        action: 'agent.run.started',
        actor: 'eng.app-delivery',
        resourceType: 'work_package',
        resourceId: 'wp-1',
        outcome: 'success',
        correlationId: 'corr-query',
      },
      'corr-query',
    );
    await service.append(
      {
        action: 'agent.run.completed',
        actor: 'eng.app-delivery',
        resourceType: 'work_package',
        resourceId: 'wp-2',
        outcome: 'success',
        correlationId: 'other',
      },
      'other',
    );
    const results = await service.query({ correlationId: 'corr-query' });
    expect(results).toHaveLength(1);
    expect(results[0]?.action).toBe('agent.run.started');
  });
});
