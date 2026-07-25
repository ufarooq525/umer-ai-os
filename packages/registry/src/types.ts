import type { SeoAuditReport } from './seo-audit.js';
import type { QaAuditReport } from './qa-audit.js';
import type { EngDeliveryReport } from './eng-delivery.js';
import type { EngChangeSetEntry } from './eng-diff.js';
import type { SecurityAuditReport } from './security-audit.js';
import type { PerfAuditReport } from './perf-audit.js';
import type { UxAuditReport } from './ux-audit.js';
import type { IntakeRoutingDecision } from './pm-routing.js';

export const packageName = '@umer/registry' as const;

export type ProjectStatus = 'active' | 'paused' | 'archived';

export type ProjectCategory = 'client-task' | 'digital-product' | 'seo-project';

export type ProjectRecord = {
  projectId: string;
  name: string;
  slug: string;
  /** Path relative to projects root (Laragon www). */
  path: string;
  status: ProjectStatus;
  /** How Umer AI OS should treat this project (intake / specialist branching). */
  category: ProjectCategory;
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
  /**
   * When true on a digital-product, eng may auto-apply after green staged suites.
   * Always present after catalog parse (zod default false). Never unlocks client-task auto.
   */
  autoApplyEng: boolean;
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
  targetFiles?: string[];
  targetModule?: string;
  proposedChanges?: EngChangeSetEntry[];
};

export type IntakePlan = {
  projectId: string;
  projectName: string;
  absolutePath: string;
  category: ProjectCategory;
  type: IntakeInstruction['type'];
  goal: string;
  summary: string;
  recommendedSpecialists: string[];
  acceptanceCriteria: string[];
  risks: string[];
  nextActions: string[];
  /** PM's read of the goal wording next to the type the operator submitted. */
  routing?: IntakeRoutingDecision;
  /** Present when type is seo — full seo.audit checklist. */
  seoAudit?: SeoAuditReport;
  /** Present when type is qa — full qa.verify checklist. */
  qaAudit?: QaAuditReport;
  /** Present when type is security — full security.review static audit. */
  securityAudit?: SecurityAuditReport;
  /** Present when type is perf — full perf.optimize Lighthouse audit. */
  perfAudit?: PerfAuditReport;
  /** Present when type is ux — full ux.design checklist audit. */
  uxAudit?: UxAuditReport;
  /**
   * Present when type is feature|bug — eng.app-delivery work package.
   * Never set for seo intake (seo-project category may still receive feature|bug eng).
   */
  engDelivery?: EngDeliveryReport;
};

export type { SeoAuditReport, SeoAuditItem, SeoCategory, SeoPriority } from './seo-audit.js';
export type { QaAuditReport, QaAuditItem, QaCategory, QaPriority } from './qa-audit.js';
export type {
  SecurityAuditReport,
  SecurityFinding,
  SecuritySeverity,
} from './security-audit.js';
export type {
  PerfAuditReport,
  PerfFinding,
  PerfSeverity,
} from './perf-audit.js';
export type {
  UxAuditReport,
  UxAuditItem,
  UxCategory,
  UxPriority,
} from './ux-audit.js';
export type {
  EngDeliveryReport,
  EngDeliveryType,
  EngWorkPackageStatus,
  EngTestPlanItem,
} from './eng-delivery.js';
export type { EngChangeSetEntry, EngResolvedEdit } from './eng-diff.js';
export type {
  IntakeRouting,
  IntakeRoutingDecision,
  IntakeTaskType,
  RoutingCandidate,
  RoutingConfidence,
} from './pm-routing.js';
export type {
  CodeProducer,
  CodeProductionRequest,
  CodeProductionOutcome,
  EngChangeSetDraft,
  EngProductionRecord,
} from './code-producer.js';
