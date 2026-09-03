/**
 * @umer/resilience — Resilience Runtime primitives: retry/backoff and timeout/cancellation.
 * Cross-cuts other packages via interfaces (MONOREPO_BLUEPRINT.md §4).
 */
export const packageName = '@umer/resilience' as const;

export { DEFAULT_RETRY, computeBackoff, withRetry, type RetryOptions } from './retry.js';
export { TimeoutError, CancelledError, withTimeout } from './timeout.js';
