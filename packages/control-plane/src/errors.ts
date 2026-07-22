export type ControlPlaneErrorCode =
  | 'NOT_FOUND'
  | 'INVALID_INPUT'
  | 'ALREADY_RESOLVED'
  | 'UNAUTHORIZED_APPROVER';

export class ControlPlaneError extends Error {
  readonly code: ControlPlaneErrorCode;

  constructor(code: ControlPlaneErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'ControlPlaneError';
    this.code = code;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}
