import { describe, expect, it } from 'vitest';
import { CancelledError, TimeoutError, withTimeout } from './timeout.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('withTimeout', () => {
  it('resolves when fn finishes before the deadline', async () => {
    await expect(withTimeout(async () => 'done', 100, 'quick')).resolves.toBe('done');
  });

  it('rejects with TimeoutError when fn exceeds the deadline', async () => {
    await expect(
      withTimeout(async (signal) => {
        await sleep(200);
        if (signal.aborted) {
          throw new Error('should not reach — race should already have rejected');
        }
        return 'too-slow';
      }, 20, 'slow-op'),
    ).rejects.toBeInstanceOf(TimeoutError);
  });

  it('aborts the inner signal on timeout', async () => {
    let sawAbort = false;
    await withTimeout(
      (signal) =>
        new Promise((resolve) => {
          signal.addEventListener('abort', () => {
            sawAbort = true;
          });
          setTimeout(resolve, 200);
        }),
      20,
      'abort-check',
    ).catch(() => undefined);
    expect(sawAbort).toBe(true);
  });

  it('rejects with CancelledError when the parent signal aborts first', async () => {
    const controller = new AbortController();
    const promise = withTimeout(
      async (signal) => {
        await sleep(200);
        if (signal.aborted) {
          throw new Error('unused');
        }
        return 'unused';
      },
      5_000,
      'cancellable',
      controller.signal,
    );
    controller.abort();
    await expect(promise).rejects.toBeInstanceOf(CancelledError);
  });

  it('rejects immediately when the parent signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      withTimeout(async () => 'unused', 5_000, 'pre-aborted', controller.signal),
    ).rejects.toBeInstanceOf(CancelledError);
  });
});
