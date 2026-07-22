import { z } from 'zod';
import { withContractHeader } from '../common/envelope.js';
import { AuditIdSchema, CorrelationIdSchema } from '../common/ids.js';

export const AuditSeveritySchema = z.enum(['info', 'notice', 'warning', 'critical']);

export const AuditContractSchema = withContractHeader({
  kind: z.literal('audit'),
  auditId: AuditIdSchema,
  action: z.string().min(1),
  actor: z.string().min(1),
  resourceType: z.string().min(1),
  resourceId: z.string().min(1),
  severity: AuditSeveritySchema.default('info'),
  correlationId: CorrelationIdSchema.optional(),
  outcome: z.enum(['success', 'failure', 'denied']),
  detail: z.record(z.string(), z.unknown()).default({}),
  occurredAt: z.string().datetime({ offset: true }),
});

export type AuditSeverity = z.infer<typeof AuditSeveritySchema>;
export type AuditContract = z.infer<typeof AuditContractSchema>;
