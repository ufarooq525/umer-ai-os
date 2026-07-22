export type AuditErrorCode =
  | 'INTEGRITY_FAILED'
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'APPEND_FAILED';

export class AuditError extends Error {
  readonly code: AuditErrorCode;

  constructor(code: AuditErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'AuditError';
    this.code = code;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}
