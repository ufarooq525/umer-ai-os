import type { SeoAuditReport } from './seo-audit.js';
import type { QaAuditReport } from './qa-audit.js';

export const packageName = '@umer/registry' as const;

export type ProjectStatus = 'active' | 'paused' | 'archived';

export type ProjectRecord = {
  projectId: string;
  name: string;
  slug: string;
  /** Path relative to projects root (Laragon www). */
  path: string;
  status: ProjectStatus;
  stack: string[];
  defaultSpecialists: string[];
  constraints: string[];
  tags: string[];
  /** Production URL for SEO verify (optional). */
  seoBaseUrl?: string;
  /** Local dev URL for SEO verify (optional). */
  seoLocalUrl?: string;
  /** Local URL for QA UI smoke (optional). */
  qaLocalUrl?: string;
  /** Preferred test command for QA apply reports (optional). */
  qaTestCommand?: string;
};

export type ProjectCatalog = {
  version: string;
  projectsRootEnv: string;
  defaultProjectsRoot: string;
  projects: ProjectRecord[];
};

export type ResolvedProject = ProjectRecord & {
  absolutePath: string;
};

export type IntakeInstruction = {
  projectId: string;
  type: 'feature' | 'seo' | 'security' | 'ux' | 'qa' | 'perf' | 'brainstorm' | 'bug';
  goal: string;
  constraints?: string[];
  doneWhen?: string;
};

export type IntakePlan = {
  projectId: string;
  projectName: string;
  absolutePath: string;
  type: IntakeInstruction['type'];
  goal: string;
  summary: string;
  recommendedSpecialists: string[];
  acceptanceCriteria: string[];
  risks: string[];
  nextActions: string[];
  /** Present when type is seo — full seo.audit checklist. */
  seoAudit?: SeoAuditReport;
  /** Present when type is qa — full qa.verify checklist. */
  qaAudit?: QaAuditReport;
};

export type { SeoAuditReport, SeoAuditItem, SeoCategory, SeoPriority } from './seo-audit.js';
export type { QaAuditReport, QaAuditItem, QaCategory, QaPriority } from './qa-audit.js';
