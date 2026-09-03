import { z } from 'zod';
import { SCHEMA_VERSION } from '../version.js';
import { CorrelationIdSchema, IdSchema, TenantIdSchema } from '../common/ids.js';

/**
 * Runtime event names — WORK_MANAGEMENT_FRAMEWORK.md §16
 * Message Fabric emits these; semantics stay in Execution.
 */
export const RuntimeEventNameSchema = z.enum([
  'request.intake',
  'request.classified',
  'request.routed',
  'request.closed',
  'exec.stage.entered',
  'exec.stage.exited',
  'exec.stage.blocked',
  'workpackage.queued',
  'workpackage.dispatched',
  'workpackage.running',
  'workpackage.completed',
  'workpackage.failed',
  'workpackage.cancelled',
  'agent.run.started',
  'agent.run.completed',
  'agent.run.failed',
  'agent.run.killed',
  'agent.mandate.violated',
  'agent.llm.requested',
  'agent.llm.completed',
  'agent.llm.failed',
  'agent.tool.requested',
  'agent.tool.started',
  'agent.tool.completed',
  'agent.tool.failed',
  'agent.decision',
  'project.created',
  'project.status.changed',
  'task.created',
  'task.assigned',
  'task.status.changed',
  'opportunity.selected',
  'opportunity.project.created',
  'artifact.sealed',
  'artifact.accepted',
  'artifact.rejected',
  'artifact.created',
  'artifact.validated',
  'artifact.transferred',
  'artifact.superseded',
  'gate.passed',
  'gate.failed',
  'gate.escalated',
  'handoff.delivered',
  'handoff.acked',
  'handoff.rejected',
  'milestone.met',
  'milestone.missed',
  'release.deployed',
  'release.rolled_back',
  'incident.opened',
  'incident.mitigated',
  'incident.closed',
  'memory.retrieve.requested',
  'memory.retrieve.completed',
  'memory.retrieve.denied',
  'memory.writeback.queued',
  'memory.writeback.acked',
  'memory.citation.missing',
  'trust.allow',
  'trust.deny',
  'trust.sandbox.violated',
  'trust.principal.bound',
  'audit.appended',
  'audit.integrity.verified',
  'audit.integrity.failed',
  'audit.access.granted',
  'audit.access.denied',
  'control.gate.wait',
  'control.gate.pass',
  'control.gate.fail',
  'control.approval.requested',
  'control.approval.resolved',
]);

export const EventEnvelopeSchema = z
  .object({
    eventId: IdSchema,
    schemaVersion: z.literal(SCHEMA_VERSION),
    name: RuntimeEventNameSchema,
    occurredAt: z.string().datetime({ offset: true }),
    correlationId: CorrelationIdSchema,
    causationId: IdSchema.optional(),
    tenantId: TenantIdSchema.optional(),
    producer: z.string().min(1),
    payload: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

/** Command plane envelope for Message Fabric (not an event). */
export const CommandEnvelopeSchema = z
  .object({
    commandId: IdSchema,
    schemaVersion: z.literal(SCHEMA_VERSION),
    name: z.string().min(1),
    issuedAt: z.string().datetime({ offset: true }),
    correlationId: CorrelationIdSchema,
    replyTo: z.string().optional(),
    tenantId: TenantIdSchema.optional(),
    producer: z.string().min(1),
    payload: z.record(z.string(), z.unknown()).default({}),
    idempotencyKey: z.string().min(1).optional(),
  })
  .strict();

export type RuntimeEventName = z.infer<typeof RuntimeEventNameSchema>;
export type EventEnvelope = z.infer<typeof EventEnvelopeSchema>;
export type CommandEnvelope = z.infer<typeof CommandEnvelopeSchema>;
