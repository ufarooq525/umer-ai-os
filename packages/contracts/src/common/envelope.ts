import { z } from 'zod';
import { SCHEMA_VERSION } from '../version.js';
import { IdSchema } from './ids.js';
import { MetadataSchema } from './metadata.js';
import { TimestampsSchema } from './timestamps.js';

/**
 * Universal header every versioned contract record carries.
 * Maps to Work Management / Artifact immutability + audit needs.
 */
export const ContractHeaderSchema = z
  .object({
    id: IdSchema,
    schemaVersion: z.literal(SCHEMA_VERSION),
    createdAt: TimestampsSchema.shape.createdAt,
    updatedAt: TimestampsSchema.shape.updatedAt,
    metadata: MetadataSchema.default({ labels: {}, annotations: {} }),
  })
  .strict();

export type ContractHeader = z.infer<typeof ContractHeaderSchema>;

export function withContractHeader<T extends z.ZodRawShape>(shape: T) {
  return z.object({ ...ContractHeaderSchema.shape, ...shape }).strict();
}
