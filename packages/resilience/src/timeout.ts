export class TimeoutError extends Error {
  readonly label: string;
  readonly timeoutMs: number;

  constructor(label: string, timeoutMs: number) {
    super(`${label} timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
    this.label = label;
    this.timeoutMs = timeoutMs;
  }
}

export class CancelledError extends Error {
  constructor(label: string) {
    super(`${label} was cancelled`);
    this.name = 'CancelledError';
  }
}

/**
 * Races `fn` against a timeout. `fn` receives an AbortSignal that fires when the
 * timeout elapses (or the caller-supplied `signal` aborts), so callers can cancel
 * in-flight work (HTTP requests, tool handlers) instead of leaking it.
 */
export async function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  label = 'operation',
  parentSignal?: AbortSignal,
): Promise<T> {
  if (parentSignal?.aborted) {
    // Short-circuit before ever invoking fn — otherwise a synchronously-resolving
    // fn can win the Promise.race below regardless of abort state, because racing
    // an already-settled promise is decided by microtask scheduling order, not
    // which one settled "first".
    throw new CancelledError(label);
  }

  const controller = new AbortController();
  let timedOut = false;

  const onParentAbort = () => controller.abort();
  if (parentSignal) {
    parentSignal.addEventListener('abort', onParentAbort);
  }

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  // controller is freshly created above and only ever aborted by the timer or a
  // future parent-abort event (the already-aborted parentSignal case threw
  // earlier), so this promise never starts in a pre-settled state — it can only
  // become rejected via a genuinely later event, which keeps it race-safe.
  const abortRejection = new Promise<T>((_, reject) => {
    controller.signal.addEventListener('abort', () => {
      reject(timedOut ? new TimeoutError(label, timeoutMs) : new CancelledError(label));
    });
  });

  try {
    return await Promise.race([fn(controller.signal), abortRejection]);
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener('abort', onParentAbort);
  }
}
