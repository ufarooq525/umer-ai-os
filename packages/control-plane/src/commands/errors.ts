export type CommandErrorCode = 'NOT_FOUND' | 'INVALID_TRANSITION' | 'UNAUTHORIZED' | 'MALFORMED_PAYLOAD';

export class CommandError extends Error {
  readonly code: CommandErrorCode;

  constructor(code: CommandErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'CommandError';
    this.code = code;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}
