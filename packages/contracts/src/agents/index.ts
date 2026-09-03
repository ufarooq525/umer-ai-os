import { z } from 'zod';
import { withContractHeader } from '../common/envelope.js';
import {
  AgentIdSchema,
  AgentRunIdSchema,
  CapabilityIdSchema,
  ProjectIdSchema,
  SpecialistIdSchema,
  TaskIdSchema,
  WorkPackageIdSchema,
} from '../common/ids.js';

/**
 * Agent — the worker identity (Enterprise_Architecture/ENTERPRISE_TAXONOMY.md:
 * "Agent" is the canonical file/taxonomy-parent identity; "Specialist" is its
 * governed worker-class refinement — same underlying object, not two nouns).
 * This contract is the runtime record of *who is doing the work right now*:
 * it references a Specialist mandate by id rather than duplicating any of the
 * mandate's own fields (mission, authority class, tool allowlist, ...) — those
 * stay owned by @umer/specialist-sdk's SpecialistContract.
 */
export const AgentStatusSchema = z.enum(['idle', 'active', 'blocked', 'offline']);

export const AgentContractSchema = withContractHeader({
  kind: z.literal('agent'),
  agentId: AgentIdSchema,
  /** Mandate this Agent executes. Identity, mission, and tool allowlist stay on the Specialist. */
  specialistId: SpecialistIdSchema,
  /** Best-effort display fields mirrored from the Specialist mandate when known. */
  name: z.string().min(1).optional(),
  department: z.string().min(1).optional(),
  capabilityIds: z.array(CapabilityIdSchema).default([]),
  status: AgentStatusSchema,
  lastSeenAt: z.string().datetime({ offset: true }).optional(),
  currentProjectId: ProjectIdSchema.optional(),
  currentTaskId: TaskIdSchema.optional(),
  currentWorkPackageId: WorkPackageIdSchema.optional(),
  currentAgentRunId: AgentRunIdSchema.optional(),
});

export type AgentStatus = z.infer<typeof AgentStatusSchema>;
export type AgentContract = z.infer<typeof AgentContractSchema>;
