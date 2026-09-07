export type AgentRuntimeErrorCode =
  | 'MANDATE_MISMATCH'
  | 'MANDATE_REFUSED'
  | 'HANDLER_FAILED'
  | 'INVALID_WORK_PACKAGE'
  | 'SPECIALIST_NOT_FOUND'
  | 'TRUST_DENIED'
  | 'LLM_NOT_CONFIGURED'
  | 'LLM_PROVIDER_ERROR'
  | 'MAX_ITERATIONS_EXCEEDED'
  | 'RUN_TIMEOUT'
  | 'RUN_CANCELLED'
  | 'RESPONSE_TRUNCATED';

export class AgentRuntimeError extends Error {
  readonly code: AgentRuntimeErrorCode;
  readonly cause?: unknown;

  constructor(code: AgentRuntimeErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'AgentRuntimeError';
    this.code = code;
    this.cause = cause;
  }
}
