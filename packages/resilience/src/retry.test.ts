import { describe, expect, it, vi } from 'vitest';
import { computeBackoff, withRetry } from './retry.js';

describe('computeBackoff', () => {
  it('doubles per attempt up to the cap', () => {
    const opts = { maxAttempts: 5, baseDelayMs: 100, maxDelayMs: 1000 };
    expect(computeBackoff(1, opts)).toBe(100);
    expect(computeBackoff(2, opts)).toBe(200);
    expect(computeBackoff(3, opts)).toBe(400);
    expect(computeBackoff(5, opts)).toBe(1000);
  });
});

describe('withRetry', () => {
  it('returns the result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    await expect(withRetry(fn, { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 2 })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries until success within maxAttempts', async () => {
    let calls = 0;
    const fn = vi.fn().mockImplementation(async () => {
      calls += 1;
      if (calls < 3) {
        throw new Error('transient');
      }
      return 'ok';
    });
    await expect(withRetry(fn, { maxAttempts: 5, baseDelayMs: 1, maxDelayMs: 2 })).resolves.toBe('ok');
    expect(calls).toBe(3);
  });

  it('throws the last error after exhausting attempts', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fails'));
    await expect(withRetry(fn, { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 2 })).rejects.toThrow(
      'always fails',
    );
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('stops immediately when isRetryable returns false', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fatal'));
    await expect(
      withRetry(fn, { maxAttempts: 5, baseDelayMs: 1, maxDelayMs: 2, isRetryable: () => false }),
    ).rejects.toThrow('fatal');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
