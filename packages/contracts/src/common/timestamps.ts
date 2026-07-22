import { z } from 'zod';

export const IsoDateTimeSchema = z
  .string()
  .datetime({ offset: true })
  .describe('ISO-8601 timestamp with offset');

export const TimestampsSchema = z
  .object({
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  })
  .strict();

export type Timestamps = z.infer<typeof TimestampsSchema>;

export function nowIso(): string {
  return new Date().toISOString();
}

export function createTimestamps(at: string = nowIso()): Timestamps {
  return { createdAt: at, updatedAt: at };
}

export function touchTimestamps(existing: Timestamps, at: string = nowIso()): Timestamps {
  return { createdAt: existing.createdAt, updatedAt: at };
}
