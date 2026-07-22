export type MemoryAccessErrorCode =
  | 'ACCESS_DENIED'
  | 'NOT_FOUND'
  | 'INVALID_INPUT'
  | 'WRITEBACK_DENIED'
  | 'CITATION_MISSING';

export class MemoryAccessError extends Error {
  readonly code: MemoryAccessErrorCode;

  constructor(code: MemoryAccessErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'MemoryAccessError';
    this.code = code;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}
