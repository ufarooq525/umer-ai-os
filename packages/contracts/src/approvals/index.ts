import { z } from 'zod';
import { withContractHeader } from '../common/envelope.js';
import { ExecIdSchema, GateIdSchema } from '../common/ids.js';

/** Approval Gates — Execution/APPROVAL_GATES.md */
export const GateResultSchema = z.enum(['Pass', 'Fail', 'FailEscalated']);

export const ApprovalContractSchema = withContractHeader({
  kind: z.literal('approval'),
  gateId: GateIdSchema,
  execId: ExecIdSchema,
  stageFrom: z.string().min(1),
  stageTo: z.string().min(1),
  result: GateResultSchema,
  requiredApprovers: z.array(z.string()).default([]),
  recordedApprovers: z.array(z.string()).default([]),
  humanRequired: z.boolean().default(false),
  rationale: z.string().min(1),
  decidedAt: z.string().datetime({ offset: true }),
});

export type GateResult = z.infer<typeof GateResultSchema>;
export type ApprovalContract = z.infer<typeof ApprovalContractSchema>;
