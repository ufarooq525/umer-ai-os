export type ModelRoutingErrorCode =
  | 'CONFIG_ERROR'
  | 'PROVIDER_ERROR'
  | 'TIMEOUT'
  | 'INVALID_RESPONSE';

export class ModelRoutingError extends Error {
  readonly code: ModelRoutingErrorCode;
  readonly cause?: unknown;

  constructor(code: ModelRoutingErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'ModelRoutingError';
    this.code = code;
    this.cause = cause;
  }
}
