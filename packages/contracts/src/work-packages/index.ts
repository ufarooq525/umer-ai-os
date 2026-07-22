import { z } from 'zod';
import { withContractHeader } from '../common/envelope.js';
import {
  CapabilityIdSchema,
  ContextHandleSchema,
  ExecIdSchema,
  SpecialistIdSchema,
  TaskIdSchema,
  WorkPackageIdSchema,
} from '../common/ids.js';

/** Work Package lifecycle — WORK_MANAGEMENT_FRAMEWORK.md §4.10 / §12 */
export const WorkPackageStatusSchema = z.enum([
  'Draft',
  'Queued',
  'Dispatched',
  'Running',
  'AwaitingReview',
  'Accepted',
  'Rejected',
  'Cancelled',
  'Failed',
]);

export const ResourceEnvelopeSchema = z
  .object({
    maxCostUnits: z.number().nonnegative().optional(),
    maxDurationMs: z.number().int().positive().optional(),
    maxToolCalls: z.number().int().positive().optional(),
    parallelism: z.number().int().positive().default(1),
  })
  .strict();

export const WorkPackageContractSchema = withContractHeader({
  kind: z.literal('work_package'),
  workPackageId: WorkPackageIdSchema,
  execId: ExecIdSchema,
  stage: z.string().min(1),
  status: WorkPackageStatusSchema,
  specialistId: SpecialistIdSchema,
  specialistSpecVersion: z.string().min(1),
  specialistSpecHash: z.string().min(1),
  taskIds: z.array(TaskIdSchema).min(1),
  capabilityIds: z.array(CapabilityIdSchema).default([]),
  contextHandle: ContextHandleSchema,
  toolAllowlist: z.array(z.string()).default([]),
  resourceEnvelope: ResourceEnvelopeSchema.default({ parallelism: 1 }),
  attempt: z.number().int().positive().default(1),
  parentWorkPackageId: WorkPackageIdSchema.optional(),
  correlationId: z.string().min(1).optional(),
});

export type WorkPackageStatus = z.infer<typeof WorkPackageStatusSchema>;
export type ResourceEnvelope = z.infer<typeof ResourceEnvelopeSchema>;
export type WorkPackageContract = z.infer<typeof WorkPackageContractSchema>;
