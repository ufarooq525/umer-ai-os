export type ExtensionErrorCode = 'DUPLICATE_TOOL' | 'INVALID_TOOL_DEFINITION';

export class ExtensionError extends Error {
  readonly code: ExtensionErrorCode;

  constructor(code: ExtensionErrorCode, message: string) {
    super(message);
    this.name = 'ExtensionError';
    this.code = code;
  }
}
