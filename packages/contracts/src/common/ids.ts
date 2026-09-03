import { z } from 'zod';

/** Opaque string IDs used across Execution / Runtime contracts. */
export const IdSchema = z.string().min(1).max(128);

export const RequestIdSchema = IdSchema.brand<'RequestId'>();
export const ExecIdSchema = z
  .string()
  .regex(/^EXEC-\d+$/, 'Must match EXEC-###')
  .brand<'ExecId'>();
export const ProjectIdSchema = IdSchema.brand<'ProjectId'>();
export const EpicIdSchema = IdSchema.brand<'EpicId'>();
export const TaskIdSchema = IdSchema.brand<'TaskId'>();
export const WorkPackageIdSchema = IdSchema.brand<'WorkPackageId'>();
export const SpecialistIdSchema = IdSchema.brand<'SpecialistId'>();
export const ArtifactIdSchema = IdSchema.brand<'ArtifactId'>();
export const ContextHandleSchema = IdSchema.brand<'ContextHandle'>();
export const MemoryIdSchema = IdSchema.brand<'MemoryId'>();
export const ToolIdSchema = IdSchema.brand<'ToolId'>();
export const GateIdSchema = IdSchema.brand<'GateId'>();
export const AuditIdSchema = IdSchema.brand<'AuditId'>();
export const CorrelationIdSchema = IdSchema.brand<'CorrelationId'>();
export const TenantIdSchema = IdSchema.brand<'TenantId'>();
export const CapabilityIdSchema = IdSchema.brand<'CapabilityId'>();
export const AgentIdSchema = IdSchema.brand<'AgentId'>();
export const AgentRunIdSchema = IdSchema.brand<'AgentRunId'>();

export type RequestId = z.infer<typeof RequestIdSchema>;
export type ExecId = z.infer<typeof ExecIdSchema>;
export type ProjectId = z.infer<typeof ProjectIdSchema>;
export type EpicId = z.infer<typeof EpicIdSchema>;
export type TaskId = z.infer<typeof TaskIdSchema>;
export type WorkPackageId = z.infer<typeof WorkPackageIdSchema>;
export type SpecialistId = z.infer<typeof SpecialistIdSchema>;
export type ArtifactId = z.infer<typeof ArtifactIdSchema>;
export type ContextHandle = z.infer<typeof ContextHandleSchema>;
export type MemoryId = z.infer<typeof MemoryIdSchema>;
export type ToolId = z.infer<typeof ToolIdSchema>;
export type GateId = z.infer<typeof GateIdSchema>;
export type AuditId = z.infer<typeof AuditIdSchema>;
export type CorrelationId = z.infer<typeof CorrelationIdSchema>;
export type TenantId = z.infer<typeof TenantIdSchema>;
export type CapabilityId = z.infer<typeof CapabilityIdSchema>;
export type AgentId = z.infer<typeof AgentIdSchema>;
export type AgentRunId = z.infer<typeof AgentRunIdSchema>;
