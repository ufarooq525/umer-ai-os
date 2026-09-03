export type RetryOptions = {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  /** Return false to stop retrying immediately (e.g. non-retryable error). Defaults to always retry. */
  isRetryable?: (err: unknown) => boolean;
};

export const DEFAULT_RETRY: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 200,
  maxDelayMs: 2_000,
};

export function computeBackoff(attempt: number, options: RetryOptions = DEFAULT_RETRY): number {
  const delay = options.baseDelayMs * 2 ** Math.max(0, attempt - 1);
  return Math.min(delay, options.maxDelayMs);
}

export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options: Partial<RetryOptions> = {},
): Promise<T> {
  const opts: RetryOptions = { ...DEFAULT_RETRY, ...options };
  let lastError: unknown;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      const retryable = opts.isRetryable ? opts.isRetryable(err) : true;
      if (!retryable || attempt >= opts.maxAttempts) {
        break;
      }
      await sleep(computeBackoff(attempt, opts));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
