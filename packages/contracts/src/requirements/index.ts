import { z } from 'zod';
import { withContractHeader } from '../common/envelope.js';
import { IdSchema, ProjectIdSchema, RequestIdSchema } from '../common/ids.js';

export const RequirementStatusSchema = z.enum(['Draft', 'Ready', 'Accepted', 'Rejected']);
export const RequirementSourceKindSchema = z.enum(['HumanPrincipal', 'Customer', 'Opportunity', 'Request', 'AutomatedSignal']);

export const RequirementSourceSchema = z.object({
  kind: RequirementSourceKindSchema,
  id: IdSchema.optional(),
  label: z.string().min(1).optional(),
}).strict();

export const RequirementDecisionSchema = z.object({
  decision: z.enum(['Approved', 'Rejected']),
  decidedBy: IdSchema,
  reason: z.string().min(1).optional(),
  decidedAt: z.string().datetime({ offset: true }),
}).strict();

/** Canonical business requirement produced from an intake Request. */
export const RequirementContractSchema = withContractHeader({
  kind: z.literal('requirement'),
  requirementId: IdSchema.brand<'RequirementId'>(),
  requestId: RequestIdSchema.optional(),
  projectId: ProjectIdSchema.optional(),
  opportunityId: IdSchema.optional(),
  customerId: IdSchema.optional(),
  status: RequirementStatusSchema,
  title: z.string().min(1).max(500),
  problem: z.string().min(1),
  desiredOutcome: z.string().min(1),
  constraints: z.array(z.string()).default([]),
  acceptanceCriteria: z.array(z.string()).min(1),
  assumptions: z.array(z.string()).default([]),
  openQuestions: z.array(z.string()).default([]),
  source: RequirementSourceSchema,
  decision: RequirementDecisionSchema.optional(),
});

export type RequirementStatus = z.infer<typeof RequirementStatusSchema>;
export type RequirementSource = z.infer<typeof RequirementSourceSchema>;
export type RequirementDecision = z.infer<typeof RequirementDecisionSchema>;
export type RequirementContract = z.infer<typeof RequirementContractSchema>;
