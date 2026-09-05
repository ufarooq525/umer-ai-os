export type OrchestrationErrorCode =
  | 'INVALID_TRANSITION'
  | 'WORK_PACKAGE_NOT_FOUND'
  | 'MAX_ATTEMPTS_EXCEEDED'
  | 'DISPATCH_FAILED'
  | 'INVALID_COMMAND'
  | 'TIMEOUT'
  | 'DUPLICATE_NODE'
  | 'DUPLICATE_EDGE'
  | 'NODE_NOT_FOUND'
  | 'PROJECT_MISMATCH'
  | 'CYCLE_DETECTED'
  | 'INVALID_NODE_TRANSITION'
  | 'MISSING_EXECUTION_CONTEXT'
  | 'SPECIALIST_NOT_RESOLVED';

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
