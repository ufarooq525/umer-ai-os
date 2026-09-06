import { z } from 'zod';
import { CommandEnvelopeSchema } from '../events/index.js';

/**
 * CEO Command & Decision Plane — command contracts.
 *
 * Builds on the existing `CommandEnvelopeSchema` (events/index.ts), which
 * already carries commandId/correlationId/issuedAt/producer/payload/
 * idempotencyKey for the Message Fabric command substrate. This module adds
 * the two fields that substrate never needed but a CEO command does: `actor`
 * (who issued it) and `target` (which entity it acts on), plus the closed set
 * of command names and their payload shapes. It does not duplicate the
 * generic envelope — it narrows it.
 */

/**
 * Mirrors @umer/trust's `TrustPrincipalKind`. Duplicated here (not imported)
 * because @umer/contracts is the dependency-free schema layer that @umer/trust
 * itself may depend on — never the other way around. Keep these two enums in
 * sync by hand; a mismatch would surface immediately as a type error at the
 * control-plane command service, which imports both.
 */
export const ActorKindSchema = z.enum(['human', 'specialist_run', 'system']);

export const ActorSchema = z
  .object({
    principalId: z.string().min(1),
    kind: ActorKindSchema,
  })
  .strict();

export const CommandTargetEntityTypeSchema = z.enum(['opportunity', 'project', 'task', 'agent']);

export const CommandTargetSchema = z
  .object({
    entityType: CommandTargetEntityTypeSchema,
    entityId: z.string().min(1),
  })
  .strict();

export const CeoCommandNameSchema = z.enum([
  'SelectOpportunity',
  'RejectOpportunity',
  'CreateProject',
  'CreateProjectFromOpportunity',
  'PauseProject',
  'ResumeProject',
  'CancelProject',
  'CreateTask',
  'AssignTask',
  'ReassignTask',
  'PauseAgent',
  'ResumeAgent',
  'CancelWork',
]);

/** CEO command envelope — narrows CommandEnvelopeSchema's `name` and adds actor/target. */
export const CeoCommandEnvelopeSchema = CommandEnvelopeSchema.extend({
  name: CeoCommandNameSchema,
  actor: ActorSchema,
  target: CommandTargetSchema.optional(),
}).strict();

// --- Per-command payload shapes -------------------------------------------

export const SelectOpportunityPayloadSchema = z
  .object({ opportunityId: z.string().min(1) })
  .strict();

export const RejectOpportunityPayloadSchema = z
  .object({ opportunityId: z.string().min(1), reason: z.string().min(1).optional() })
  .strict();

export const CreateProjectPayloadSchema = z
  .object({
    name: z.string().min(1),
    owner: z.string().min(1).optional(),
    /** Links this project to a real, catalog-registered codebase — see ProjectContract's field of the same name. */
    registryProjectId: z.string().min(1).optional(),
  })
  .strict();

export const CreateProjectFromOpportunityPayloadSchema = z
  .object({
    opportunityId: z.string().min(1),
    name: z.string().min(1).optional(),
    owner: z.string().min(1).optional(),
  })
  .strict();

export const PauseProjectPayloadSchema = z
  .object({ projectId: z.string().min(1), reason: z.string().min(1).optional() })
  .strict();

export const ResumeProjectPayloadSchema = z.object({ projectId: z.string().min(1) }).strict();

export const CancelProjectPayloadSchema = z
  .object({ projectId: z.string().min(1), reason: z.string().min(1).optional() })
  .strict();

export const CreateTaskPayloadSchema = z
  .object({
    epicId: z.string().min(1),
    projectId: z.string().min(1),
    title: z.string().min(1),
    description: z.string().min(1),
    acceptanceCriteria: z.array(z.string().min(1)).min(1),
    capabilityIds: z.array(z.string()).optional(),
  })
  .strict();

export const AssignTaskPayloadSchema = z
  .object({ taskId: z.string().min(1), agentId: z.string().min(1) })
  .strict();

export const ReassignTaskPayloadSchema = z
  .object({
    taskId: z.string().min(1),
    agentId: z.string().min(1),
    reason: z.string().min(1).optional(),
  })
  .strict();

export const PauseAgentPayloadSchema = z
  .object({ agentId: z.string().min(1), reason: z.string().min(1).optional() })
  .strict();

export const ResumeAgentPayloadSchema = z.object({ agentId: z.string().min(1) }).strict();

export const CancelWorkPayloadSchema = z
  .object({
    agentId: z.string().min(1),
    workPackageId: z.string().min(1).optional(),
    taskId: z.string().min(1).optional(),
    reason: z.string().min(1).optional(),
  })
  .strict();

export const CEO_COMMAND_PAYLOAD_SCHEMAS = {
  SelectOpportunity: SelectOpportunityPayloadSchema,
  RejectOpportunity: RejectOpportunityPayloadSchema,
  CreateProject: CreateProjectPayloadSchema,
  CreateProjectFromOpportunity: CreateProjectFromOpportunityPayloadSchema,
  PauseProject: PauseProjectPayloadSchema,
  ResumeProject: ResumeProjectPayloadSchema,
  CancelProject: CancelProjectPayloadSchema,
  CreateTask: CreateTaskPayloadSchema,
  AssignTask: AssignTaskPayloadSchema,
  ReassignTask: ReassignTaskPayloadSchema,
  PauseAgent: PauseAgentPayloadSchema,
  ResumeAgent: ResumeAgentPayloadSchema,
  CancelWork: CancelWorkPayloadSchema,
} as const satisfies Record<CeoCommandName, z.ZodTypeAny>;

export type ActorKind = z.infer<typeof ActorKindSchema>;
export type Actor = z.infer<typeof ActorSchema>;
export type CommandTargetEntityType = z.infer<typeof CommandTargetEntityTypeSchema>;
export type CommandTarget = z.infer<typeof CommandTargetSchema>;
export type CeoCommandName = z.infer<typeof CeoCommandNameSchema>;
export type CeoCommandEnvelope = z.infer<typeof CeoCommandEnvelopeSchema>;

export type SelectOpportunityPayload = z.infer<typeof SelectOpportunityPayloadSchema>;
export type RejectOpportunityPayload = z.infer<typeof RejectOpportunityPayloadSchema>;
export type CreateProjectPayload = z.infer<typeof CreateProjectPayloadSchema>;
export type CreateProjectFromOpportunityPayload = z.infer<
  typeof CreateProjectFromOpportunityPayloadSchema
>;
export type PauseProjectPayload = z.infer<typeof PauseProjectPayloadSchema>;
export type ResumeProjectPayload = z.infer<typeof ResumeProjectPayloadSchema>;
export type CancelProjectPayload = z.infer<typeof CancelProjectPayloadSchema>;
export type CreateTaskPayload = z.infer<typeof CreateTaskPayloadSchema>;
export type AssignTaskPayload = z.infer<typeof AssignTaskPayloadSchema>;
export type ReassignTaskPayload = z.infer<typeof ReassignTaskPayloadSchema>;
export type PauseAgentPayload = z.infer<typeof PauseAgentPayloadSchema>;
export type ResumeAgentPayload = z.infer<typeof ResumeAgentPayloadSchema>;
export type CancelWorkPayload = z.infer<typeof CancelWorkPayloadSchema>;

export type CeoCommandPayloadByName = {
  SelectOpportunity: SelectOpportunityPayload;
  RejectOpportunity: RejectOpportunityPayload;
  CreateProject: CreateProjectPayload;
  CreateProjectFromOpportunity: CreateProjectFromOpportunityPayload;
  PauseProject: PauseProjectPayload;
  ResumeProject: ResumeProjectPayload;
  CancelProject: CancelProjectPayload;
  CreateTask: CreateTaskPayload;
  AssignTask: AssignTaskPayload;
  ReassignTask: ReassignTaskPayload;
  PauseAgent: PauseAgentPayload;
  ResumeAgent: ResumeAgentPayload;
  CancelWork: CancelWorkPayload;
};

/** Parses a command's untyped payload against the schema for its `name`. Throws ZodError on mismatch. */
export function parseCeoCommandPayload<Name extends CeoCommandName>(
  name: Name,
  payload: unknown,
): CeoCommandPayloadByName[Name] {
  const schema = CEO_COMMAND_PAYLOAD_SCHEMAS[name];
  return schema.parse(payload) as CeoCommandPayloadByName[Name];
}
