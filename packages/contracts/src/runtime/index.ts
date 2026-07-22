import { z } from 'zod';
import { withContractHeader } from '../common/envelope.js';
import {
  CorrelationIdSchema,
  WorkPackageIdSchema,
} from '../common/ids.js';

/** Agent / Runtime mechanical run — not Specialist Spec content. */
export const AgentRunStatusSchema = z.enum([
  'started',
  'completed',
  'failed',
  'killed',
]);

export const AgentRunContractSchema = withContractHeader({
  kind: z.literal('agent_run'),
  runId: z.string().min(1),
  workPackageId: WorkPackageIdSchema,
  status: AgentRunStatusSchema,
  specialistSpecHash: z.string().min(1),
  mandateViolated: z.boolean().default(false),
  correlationId: CorrelationIdSchema.optional(),
  startedAt: z.string().datetime({ offset: true }),
  finishedAt: z.string().datetime({ offset: true }).optional(),
  errorMessage: z.string().optional(),
});

export const RuntimeHealthSchema = z
  .object({
    status: z.enum(['ok', 'degraded', 'down']),
    service: z.string().min(1),
    ts: z.string().datetime({ offset: true }),
    details: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

export type AgentRunStatus = z.infer<typeof AgentRunStatusSchema>;
export type AgentRunContract = z.infer<typeof AgentRunContractSchema>;
export type RuntimeHealth = z.infer<typeof RuntimeHealthSchema>;
