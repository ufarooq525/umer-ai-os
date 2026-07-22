export class MessageFabricError extends Error {
  readonly code: string;

  constructor(code: string, message: string, cause?: unknown) {
    super(message);
    this.name = 'MessageFabricError';
    this.code = code;
    if (cause instanceof Error) {
      this.cause = cause;
    }
  }
}
