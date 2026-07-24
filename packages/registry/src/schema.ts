import { z } from 'zod';

export const ProjectRecordSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  path: z.string().min(1),
  status: z.enum(['active', 'paused', 'archived']).default('active'),
  stack: z.array(z.string()).default([]),
  defaultSpecialists: z.array(z.string()).default(['pm.intake']),
  constraints: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  seoBaseUrl: z.string().url().optional(),
  seoLocalUrl: z.string().url().optional(),
  qaLocalUrl: z.string().url().optional(),
  qaTestCommand: z.string().min(1).optional(),
});

export const ProjectCatalogSchema = z.object({
  version: z.string().min(1),
  projectsRootEnv: z.string().default('UMER_PROJECTS_ROOT'),
  defaultProjectsRoot: z.string().min(1),
  projects: z.array(ProjectRecordSchema).min(1),
});

export const IntakeInstructionSchema = z.object({
  projectId: z.string().min(1),
  type: z.enum(['feature', 'seo', 'security', 'ux', 'qa', 'perf', 'brainstorm', 'bug']),
  goal: z.string().min(8),
  constraints: z.array(z.string()).optional(),
  doneWhen: z.string().optional(),
});

export const IntakePlanSchema = z.object({
  projectId: z.string(),
  projectName: z.string(),
  absolutePath: z.string(),
  type: IntakeInstructionSchema.shape.type,
  goal: z.string(),
  summary: z.string(),
  recommendedSpecialists: z.array(z.string()),
  acceptanceCriteria: z.array(z.string()),
  risks: z.array(z.string()),
  nextActions: z.array(z.string()),
});
