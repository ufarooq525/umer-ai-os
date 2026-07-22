import { z } from 'zod';
import { TenantIdSchema } from './ids.js';

export const MetadataSchema = z
  .object({
    tenantId: TenantIdSchema.optional(),
    labels: z.record(z.string(), z.string()).default({}),
    annotations: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

export type Metadata = z.infer<typeof MetadataSchema>;

export function emptyMetadata(): Metadata {
  return { labels: {}, annotations: {} };
}
