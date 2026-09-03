import { z } from 'zod';
import { withContractHeader } from '../common/envelope.js';
import {
  AgentIdSchema,
  ExecIdSchema,
  ProjectIdSchema,
  RequestIdSchema,
  TaskIdSchema,
  EpicIdSchema,
  CapabilityIdSchema,
} from '../common/ids.js';

/** Workflow Engine instance + scheduling units referenced on the wire. */

export const ExecStageSchema = z.enum([
  'Scoped',
  'Research',
  'Architecture',
  'Design',
  'Development',
  'QA',
  'SEO',
  'Marketing',
  'Deployment',
  'Analytics',
  'Monitoring',
  'Learning',
  'RejectedAtScoping',
  'Abandoned',
  'FailedUnrecovered',
]);

export const ExecInstanceContractSchema = withContractHeader({
  kind: z.literal('exec_instance'),
  execId: ExecIdSchema,
  requestId: RequestIdSchema,
  projectId: ProjectIdSchema,
  currentStage: ExecStageSchema,
  completedStages: z.array(ExecStageSchema).default([]),
  skippedStages: z
    .array(
      z
        .object({
          stage: ExecStageSchema,
          reason: z.string().min(1),
        })
        .strict(),
    )
    .default([]),
});

export const TaskClassSchema = z.enum([
  'Standard',
  'Spike',
  'Research',
  'DefectFix',
  'Change',
]);

export const TaskStatusSchema = z.enum([
  'Backlog',
  'Ready',
  'Assigned',
  'InProgress',
  'Blocked',
  'InReview',
  'Done',
  'Cancelled',
]);

export const TaskContractSchema = withContractHeader({
  kind: z.literal('task'),
  taskId: TaskIdSchema,
  epicId: EpicIdSchema,
  projectId: ProjectIdSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  status: TaskStatusSchema,
  workClass: TaskClassSchema.default('Standard'),
  acceptanceCriteria: z.array(z.string().min(1)).min(1),
  capabilityIds: z.array(CapabilityIdSchema).default([]),
  owner: z.string().min(1).optional(),
  /** Agent (worker identity) currently assigned to this Task — distinct from `owner`. */
  assignedAgentId: AgentIdSchema.optional(),
  sprintId: z.string().optional(),
  workPackageId: z.string().optional(),
});

export const DependencyTypeSchema = z.enum([
  'finish_to_start',
  'start_to_start',
  'artifact_consumer',
  'external',
]);

export const DependencyContractSchema = withContractHeader({
  kind: z.literal('dependency'),
  dependencyId: z.string().min(1),
  fromId: z.string().min(1),
  toId: z.string().min(1),
  dependencyType: DependencyTypeSchema,
  status: z.enum(['Open', 'Satisfied', 'Waived', 'Broken']),
});

export type ExecStage = z.infer<typeof ExecStageSchema>;
export type ExecInstanceContract = z.infer<typeof ExecInstanceContractSchema>;
export type TaskClass = z.infer<typeof TaskClassSchema>;
export type TaskStatus = z.infer<typeof TaskStatusSchema>;
export type TaskContract = z.infer<typeof TaskContractSchema>;
export type DependencyType = z.infer<typeof DependencyTypeSchema>;
export type DependencyContract = z.infer<typeof DependencyContractSchema>;
