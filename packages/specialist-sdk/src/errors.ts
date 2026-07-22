export type SpecialistSdkErrorCode =
  | 'PARSE_FAILED'
  | 'VALIDATION_FAILED'
  | 'BIND_FAILED'
  | 'REGISTER_FAILED'
  | 'MANDATE_REFUSED'
  | 'SPEC_NOT_FOUND';

export class SpecialistSdkError extends Error {
  readonly code: SpecialistSdkErrorCode;
  readonly cause?: unknown;

  constructor(code: SpecialistSdkErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'SpecialistSdkError';
    this.code = code;
    this.cause = cause;
  }
}
