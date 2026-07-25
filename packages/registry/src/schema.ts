import { z } from 'zod';

export const ProjectCategorySchema = z.enum(['client-task', 'digital-product', 'seo-project']);

/** Explicit eng change-set entry — no free-form patch apply. */
export const EngChangeSetEntrySchema = z.object({
  path: z.string().min(1).max(400),
  /** null = create; string = expected current file contents for modify. */
  expectedContent: z.string().nullable(),
  expectedHash: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
  content: z.string(),
  note: z.string().max(500).optional(),
});

export const ProjectRecordSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  path: z.string().min(1),
  status: z.enum(['active', 'paused', 'archived']).default('active'),
  category: ProjectCategorySchema,
  stack: z.array(z.string()).default([]),
  defaultSpecialists: z.array(z.string()).default(['pm.intake']),
  constraints: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  seoBaseUrl: z.string().url().optional(),
  seoLocalUrl: z.string().url().optional(),
  qaLocalUrl: z.string().url().optional(),
  qaTestCommand: z.string().min(1).optional(),
  /**
   * Opt-in digital-product auto-apply for eng when staged suites are green.
   * Default false. Ignored for client-task (always human gate).
   */
  autoApplyEng: z.boolean().default(false),
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
  /** Optional eng scope hints (feature|bug only). */
  targetFiles: z.array(z.string().min(1)).max(16).optional(),
  targetModule: z.string().min(1).max(200).optional(),
  /** Explicit change-set for eng.app-delivery (feature|bug only). */
  proposedChanges: z.array(EngChangeSetEntrySchema).max(8).optional(),
});

export const IntakePlanSchema = z.object({
  projectId: z.string(),
  projectName: z.string(),
  absolutePath: z.string(),
  category: ProjectCategorySchema,
  type: IntakeInstructionSchema.shape.type,
  goal: z.string(),
  summary: z.string(),
  recommendedSpecialists: z.array(z.string()),
  acceptanceCriteria: z.array(z.string()),
  risks: z.array(z.string()),
  nextActions: z.array(z.string()),
});
