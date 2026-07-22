import { z } from 'zod';

export const ContractErrorCodeSchema = z.enum([
  'VALIDATION_FAILED',
  'PARSE_FAILED',
  'SERIALIZE_FAILED',
  'UNSUPPORTED_SCHEMA_VERSION',
  'CONTRACT_MISMATCH',
]);

export type ContractErrorCode = z.infer<typeof ContractErrorCodeSchema>;

export const ContractIssueSchema = z
  .object({
    path: z.string(),
    message: z.string(),
    code: z.string().optional(),
  })
  .strict();

export type ContractIssue = z.infer<typeof ContractIssueSchema>;

export const ContractErrorBodySchema = z
  .object({
    code: ContractErrorCodeSchema,
    message: z.string(),
    issues: z.array(ContractIssueSchema).default([]),
    cause: z.string().optional(),
  })
  .strict();

export type ContractErrorBody = z.infer<typeof ContractErrorBodySchema>;

export class ContractError extends Error {
  readonly code: ContractErrorCode;
  readonly issues: ContractIssue[];
  readonly causeMessage?: string;

  constructor(body: ContractErrorBody) {
    super(body.message);
    this.name = 'ContractError';
    this.code = body.code;
    this.issues = body.issues;
    this.causeMessage = body.cause;
  }

  toJSON(): ContractErrorBody {
    return {
      code: this.code,
      message: this.message,
      issues: this.issues,
      ...(this.causeMessage ? { cause: this.causeMessage } : {}),
    };
  }

  static fromZod(error: z.ZodError, message = 'Contract validation failed'): ContractError {
    return new ContractError({
      code: 'VALIDATION_FAILED',
      message,
      issues: error.issues.map((i) => ({
        path: i.path.join('.') || '(root)',
        message: i.message,
        code: i.code,
      })),
    });
  }
}
