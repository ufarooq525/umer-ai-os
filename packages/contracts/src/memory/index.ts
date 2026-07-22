import { z } from 'zod';
import { withContractHeader } from '../common/envelope.js';
import { MemoryIdSchema, TenantIdSchema } from '../common/ids.js';

/** Memory Access plumbing contracts — content SoR remains Intelligence. */
export const MemoryScopeSchema = z.enum(['read', 'write', 'read_write']);

export const MemoryKindSchema = z.enum([
  'Lesson',
  'Pattern',
  'BestPractice',
  'Research',
  'DecisionIntel',
  'CaseStudy',
  'WorkingNote',
]);

export const MemoryContractSchema = withContractHeader({
  kind: z.literal('memory'),
  memoryId: MemoryIdSchema,
  memoryKind: MemoryKindSchema,
  scope: MemoryScopeSchema,
  tenantId: TenantIdSchema.optional(),
  title: z.string().min(1),
  contentRef: z.string().min(1),
  embeddingRef: z.string().optional(),
  tags: z.array(z.string()).default([]),
  retentionClass: z.enum(['ephemeral', 'standard', 'durable']).default('standard'),
});

export type MemoryScope = z.infer<typeof MemoryScopeSchema>;
export type MemoryKind = z.infer<typeof MemoryKindSchema>;
export type MemoryContract = z.infer<typeof MemoryContractSchema>;
