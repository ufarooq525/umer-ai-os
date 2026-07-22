export type ArtifactEngineErrorCode =
  | 'NOT_FOUND'
  | 'SEAL_VIOLATION'
  | 'VALIDATION_FAILED'
  | 'TRANSFER_FAILED'
  | 'SUPERSEDE_FAILED'
  | 'INVALID_INPUT';

export class ArtifactEngineError extends Error {
  readonly code: ArtifactEngineErrorCode;

  constructor(code: ArtifactEngineErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'ArtifactEngineError';
    this.code = code;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}
