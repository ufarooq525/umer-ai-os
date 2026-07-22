import { z } from 'zod';
import { withContractHeader } from '../common/envelope.js';
import { ContextHandleSchema, ExecIdSchema, ProjectIdSchema } from '../common/ids.js';

/**
 * Context Package mechanics handle — Execution CONTEXT_MANAGEMENT + Context Runtime.
 * Semantics owned by Execution; this is the transferable handle + keys.
 */
export const ContextEntrySchema = z
  .object({
    key: z.string().min(1),
    valueRef: z.string().min(1),
    required: z.boolean().default(true),
    freshness: z.enum(['fresh', 'stale', 'unknown']).default('unknown'),
  })
  .strict();

export const ContextContractSchema = withContractHeader({
  kind: z.literal('context'),
  contextHandle: ContextHandleSchema,
  execId: ExecIdSchema,
  projectId: ProjectIdSchema.optional(),
  entries: z.array(ContextEntrySchema).default([]),
  intelligenceRefs: z.array(z.string()).default([]),
});

export type ContextEntry = z.infer<typeof ContextEntrySchema>;
export type ContextContract = z.infer<typeof ContextContractSchema>;
