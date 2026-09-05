import { z } from 'zod';
import { withContractHeader } from '../common/envelope.js';
import {
  ProjectIdSchema,
  WorkGraphEdgeIdSchema,
  WorkGraphNodeIdSchema,
  WorkPackageIdSchema,
} from '../common/ids.js';

/**
 * Work Graph — the dependency graph a Project's delivery decomposes into
 * (Requirements → Product → Architecture → UX → Implementation → QA →
 * Security → Release → Operations), per the product vision's pipeline.
 * Distinct from a Work Package (one unit of dispatched Specialist work):
 * a graph node becomes dispatchable (a real Work Package gets created and
 * attached) once it's Ready — see @umer/orchestration's
 * ReadyWorkPackagePlanner.
 */
export const WorkGraphNodeTypeSchema = z.enum([
  'Project',
  'Requirements',
  'Product',
  'Architecture',
  'UX',
  'Implementation',
  'QA',
  'Security',
  'Release',
  'Operations',
]);

export const WorkGraphNodeStatusSchema = z.enum([
  'Planned',
  'Ready',
  'Blocked',
  'InProgress',
  'Review',
  'Accepted',
  'Failed',
  'Cancelled',
]);

export const WorkGraphEdgeTypeSchema = z.enum(['blocks', 'requires']);

export const WorkGraphNodeContractSchema = withContractHeader({
  kind: z.literal('work_graph_node'),
  nodeId: WorkGraphNodeIdSchema,
  projectId: ProjectIdSchema,
  type: WorkGraphNodeTypeSchema,
  status: WorkGraphNodeStatusSchema,
  title: z.string().min(1),
  /** Set once a real Work Package is created and attached for this node (ReadyWorkPackagePlanner). */
  workPackageId: WorkPackageIdSchema.optional(),
});

/**
 * `blocks` (A blocks B): B cannot become Ready until A is Accepted.
 * `requires` (A requires B): A cannot become Ready until B is Accepted.
 * Both encode a "must-finish-before" precedence — `requires` just reads in
 * the opposite natural-language direction from `blocks`.
 */
export const WorkGraphEdgeContractSchema = withContractHeader({
  kind: z.literal('work_graph_edge'),
  edgeId: WorkGraphEdgeIdSchema,
  projectId: ProjectIdSchema,
  fromNodeId: WorkGraphNodeIdSchema,
  toNodeId: WorkGraphNodeIdSchema,
  type: WorkGraphEdgeTypeSchema,
});

export type WorkGraphNodeType = z.infer<typeof WorkGraphNodeTypeSchema>;
export type WorkGraphNodeStatus = z.infer<typeof WorkGraphNodeStatusSchema>;
export type WorkGraphEdgeType = z.infer<typeof WorkGraphEdgeTypeSchema>;
export type WorkGraphNodeContract = z.infer<typeof WorkGraphNodeContractSchema>;
export type WorkGraphEdgeContract = z.infer<typeof WorkGraphEdgeContractSchema>;
