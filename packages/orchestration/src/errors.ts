export type OrchestrationErrorCode =
  | 'INVALID_TRANSITION'
  | 'WORK_PACKAGE_NOT_FOUND'
  | 'MAX_ATTEMPTS_EXCEEDED'
  | 'DISPATCH_FAILED'
  | 'INVALID_COMMAND'
  | 'TIMEOUT';

export class OrchestrationError extends Error {
  readonly code: OrchestrationErrorCode;
  readonly cause?: unknown;

  constructor(code: OrchestrationErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'OrchestrationError';
    this.code = code;
    this.cause = cause;
  }
}
