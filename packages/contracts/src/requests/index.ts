import { z } from 'zod';
import { withContractHeader } from '../common/envelope.js';
import { ProjectIdSchema, RequestIdSchema } from '../common/ids.js';

/** Request Lifecycle stages — Execution/REQUEST_LIFECYCLE.md */
export const RequestStatusSchema = z.enum([
  'Intake',
  'Classification',
  'Prioritization',
  'Scoping',
  'Routing',
  'Closure',
  'Deprioritized',
]);

/** Classification Type */
export const RequestTypeSchema = z.enum([
  'NewObjective',
  'Enhancement',
  'Defect',
  'Inquiry',
  'Signal',
]);

export const RequestScopeClassSchema = z.enum([
  'SingleDepartment',
  'CrossDepartment',
  'GovernanceLevel',
]);

export const RequestSourceKindSchema = z.enum([
  'HumanPrincipal',
  'Department',
  'AutomatedSignal',
]);

export const RequestSourceSchema = z
  .object({
    kind: RequestSourceKindSchema,
    name: z.string().min(1).optional(),
  })
  .strict();

export const RequestScopingSchema = z
  .object({
    clarifiedGoal: z.string().min(1),
    constraints: z.array(z.string()).default([]),
    successCriteria: z.array(z.string()).min(1),
    openQuestionsResolved: z.array(z.string()).default([]),
    stillAmbiguous: z.array(z.string()).default([]),
  })
  .strict();

export const RequestClosureSchema = z
  .object({
    resolution: z.enum([
      'CompletedViaExec',
      'AnsweredDirectly',
      'Rejected',
      'Merged',
      'Deprioritized',
    ]),
    execId: z.string().optional(),
    mergedIntoRequestId: RequestIdSchema.optional(),
    reason: z.string().optional(),
    closedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export const RequestContractSchema = withContractHeader({
  kind: z.literal('request'),
  requestId: RequestIdSchema,
  slug: z.string().min(1).max(128),
  status: RequestStatusSchema,
  source: RequestSourceSchema,
  rawDescription: z.string().min(1),
  type: RequestTypeSchema.optional(),
  scopeClass: RequestScopeClassSchema.optional(),
  priorityScore: z.number().min(0).optional(),
  scoping: RequestScopingSchema.optional(),
  projectId: ProjectIdSchema.optional(),
  closure: RequestClosureSchema.optional(),
});

export type RequestStatus = z.infer<typeof RequestStatusSchema>;
export type RequestType = z.infer<typeof RequestTypeSchema>;
export type RequestScopeClass = z.infer<typeof RequestScopeClassSchema>;
export type RequestSource = z.infer<typeof RequestSourceSchema>;
export type RequestScoping = z.infer<typeof RequestScopingSchema>;
export type RequestClosure = z.infer<typeof RequestClosureSchema>;
export type RequestContract = z.infer<typeof RequestContractSchema>;
