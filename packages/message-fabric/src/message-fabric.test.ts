import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION } from '@umer/contracts';
import { STREAMS, SUBJECTS } from './constants.js';
import { MessageFabricError } from './errors.js';
import {
  createCommandEnvelope,
  createEventEnvelope,
  parseCommandEnvelope,
  parseEventEnvelope,
} from './envelopes.js';
import { InMemoryIdempotencyStore } from './idempotency.js';
import { computeBackoff, withRetry } from './retry.js';

describe('constants', () => {
  it('defines stream and subject names', () => {
    expect(STREAMS.COMMANDS).toBe('UMER_COMMANDS');
    expect(SUBJECTS.CMD_AGENT_DISPATCH).toBe('cmd.agent.dispatch');
  });
});

describe('envelopes', () => {
  it('creates and parses command envelope', () => {
    const cmd = createCommandEnvelope({
      name: 'workpackage.dispatch',
      producer: 'control-api',
      correlationId: 'corr-1',
      payload: { workPackageId: 'wp-1' },
      idempotencyKey: 'idem-1',
    });
    expect(cmd.schemaVersion).toBe(SCHEMA_VERSION);
    expect(cmd.name).toBe('workpackage.dispatch');
    const parsed = parseCommandEnvelope(cmd);
    expect(parsed.correlationId).toBe('corr-1');
  });

  it('creates event envelope', () => {
    const evt = createEventEnvelope({
      name: 'workpackage.queued',
      producer: 'orchestration',
      correlationId: 'corr-2',
      payload: {},
    });
    expect(evt.name).toBe('workpackage.queued');
    expect(parseEventEnvelope(evt).correlationId).toBe('corr-2');
  });
});

describe('idempotency store', () => {
  it('tracks keys with ttl', async () => {
    const store = new InMemoryIdempotencyStore();
    expect(await store.has('k1')).toBe(false);
    await store.mark('k1', 60_000);
    expect(await store.has('k1')).toBe(true);
  });

  it('expires keys after ttl', async () => {
    const store = new InMemoryIdempotencyStore();
    await store.mark('k1', -1);
    expect(await store.has('k1')).toBe(false);
  });

  it('evicts expired keys during lookup', async () => {
    const store = new InMemoryIdempotencyStore();
    await store.mark('expired', -1);
    await store.mark('active', 60_000);
    expect(await store.has('expired')).toBe(false);
    expect(await store.has('active')).toBe(true);
  });

  it('clears all tracked keys', async () => {
    const store = new InMemoryIdempotencyStore();
    await store.mark('k1', 60_000);
    store.clear();
    expect(await store.has('k1')).toBe(false);
  });
});

describe('retry', () => {
  it('computes exponential backoff', () => {
    expect(computeBackoff(1)).toBe(100);
    expect(computeBackoff(3)).toBe(400);
  });

  it('retries until success', async () => {
    let attempts = 0;
    const result = await withRetry(async () => {
      attempts += 1;
      if (attempts < 3) {
        throw new Error('fail');
      }
      return 'ok';
    }, { maxAttempts: 5, baseDelayMs: 1, maxDelayMs: 10 });
    expect(result).toBe('ok');
    expect(attempts).toBe(3);
  });

  it('throws after max attempts', async () => {
    await expect(
      withRetry(async () => {
        throw new Error('always');
      }, { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 5 }),
    ).rejects.toThrow('always');
  });
});

describe('MessageFabricError', () => {
  it('carries code and optional cause', () => {
    const err = new MessageFabricError('PUBLISH_FAILED', 'failed', new Error('root'));
    expect(err.code).toBe('PUBLISH_FAILED');
    expect(err.cause).toBeInstanceOf(Error);
  });
});
