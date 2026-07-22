export type TrustErrorCode = 'ACCESS_DENIED' | 'INVALID_INPUT' | 'GRANT_NOT_FOUND';

export class TrustError extends Error {
  readonly code: TrustErrorCode;

  constructor(code: TrustErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'TrustError';
    this.code = code;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}
