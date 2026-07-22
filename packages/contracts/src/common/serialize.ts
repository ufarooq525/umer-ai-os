import { type z } from 'zod';
import { ContractError } from './errors.js';

export type ParseSuccess<T> = { success: true; data: T };
export type ParseFailure = { success: false; error: ContractError };
export type ParseResult<T> = ParseSuccess<T> | ParseFailure;

export function formatUnknownError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Validate unknown input against a Zod schema; throw ContractError on failure.
 */
export function parseContract<S extends z.ZodTypeAny>(
  schema: S,
  input: unknown,
  message?: string,
): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw ContractError.fromZod(result.error, message);
  }
  return result.data;
}

/**
 * Non-throwing validation helper for service boundaries.
 */
export function safeParseContract<S extends z.ZodTypeAny>(
  schema: S,
  input: unknown,
  message?: string,
): ParseResult<z.infer<S>> {
  const result = schema.safeParse(input);
  if (!result.success) {
    return { success: false, error: ContractError.fromZod(result.error, message) };
  }
  return { success: true, data: result.data };
}

/**
 * Serialize a validated contract to a JSON string (stable wire form).
 */
export function serializeContract<T>(value: T): string {
  try {
    return JSON.stringify(value);
  } catch (err) {
    throw new ContractError({
      code: 'SERIALIZE_FAILED',
      message: 'Failed to serialize contract',
      issues: [],
      cause: formatUnknownError(err),
    });
  }
}

/**
 * Deserialize JSON then validate against schema.
 */
export function deserializeContract<S extends z.ZodTypeAny>(
  schema: S,
  raw: string,
  message?: string,
): z.infer<S> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (err) {
    throw new ContractError({
      code: 'PARSE_FAILED',
      message: 'Failed to parse contract JSON',
      issues: [],
      cause: formatUnknownError(err),
    });
  }
  return parseContract(schema, parsed, message);
}

/**
 * Deep-freeze a contract value for immutability at runtime (best-effort).
 */
export function freezeContract<T>(value: T): Readonly<T> {
  return deepFreeze(value);
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  Object.freeze(value);
  for (const key of Reflect.ownKeys(value as object)) {
    const child = (value as Record<string | symbol, unknown>)[key];
    if (child && typeof child === 'object' && !Object.isFrozen(child)) {
      deepFreeze(child);
    }
  }
  return value;
}
