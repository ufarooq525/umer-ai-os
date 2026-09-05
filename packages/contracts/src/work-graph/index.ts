import { z } from 'zod';

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

export const WorkGraphNodeSchema = z.object({
  nodeId: z.string().min(1),
  projectId: z.string().min(1),
  type: WorkGraphNodeTypeSchema,
  title: z.string().min(1),
  status: WorkGraphNodeStatusSchema,
  workPackageId: z.string().min(1).optional(),
  requiredCapabilityIds: z.array(z.string().min(1)).default([]),
  metadata: z.record(z.unknown()).default({}),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const WorkGraphEdgeSchema = z.object({
  edgeId: z.string().min(1),
  projectId: z.string().min(1),
  fromNodeId: z.string().min(1),
  toNodeId: z.string().min(1),
  dependencyType: z.enum(['blocks', 'requires']),
  createdAt: z.string().datetime(),
});

export type WorkGraphNodeType = z.infer<typeof WorkGraphNodeTypeSchema>;
export type WorkGraphNodeStatus = z.infer<typeof WorkGraphNodeStatusSchema>;
export type WorkGraphNode = z.infer<typeof WorkGraphNodeSchema>;
export type WorkGraphEdge = z.infer<typeof WorkGraphEdgeSchema>;
