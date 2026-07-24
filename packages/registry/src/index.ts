/**
 * @umer/registry — Project catalog for Umer AI OS (Laragon multi-project).
 *
 * Add a project later: append an entry to projects/catalog.json and restart control-api.
 */

export { packageName } from './types.js';
export type {
  ProjectStatus,
  ProjectRecord,
  ProjectCatalog,
  ResolvedProject,
  IntakeInstruction,
  IntakePlan,
} from './types.js';
export { ProjectRegistryError, type ProjectRegistryErrorCode } from './errors.js';
export {
  ProjectRecordSchema,
  ProjectCatalogSchema,
  IntakeInstructionSchema,
  IntakePlanSchema,
} from './schema.js';
export { resolveProjectsRoot, loadCatalogFromFile, resolveProjectPath } from './catalog.js';
export { ProjectRegistry, createProjectRegistry } from './registry.js';
export { planIntake } from './intake.js';
export { runSeoAudit } from './seo-audit.js';
export type {
  SeoAuditReport,
  SeoAuditItem,
  SeoCategory,
  SeoPriority,
} from './seo-audit.js';
export { applySeoToProject } from './seo-apply.js';
export type { SeoApplyResult, SeoApplyFileChange } from './seo-result-types.js';
export {
  extractPageSeoSignals,
  evaluateSeoChecks,
  enrichWithRobotsSitemap,
} from './seo-verify.js';
export type { SeoCheckResult, SeoCheckStatus, PageSeoSignals } from './seo-verify.js';
export { runLighthouseEvidence } from './seo-lighthouse.js';
export type { LighthouseEvidence } from './seo-lighthouse.js';
export { applySafeSeoPatches } from './seo-patch.js';
export { resolveSeoProbeUrls, pickReachableSeoUrl } from './seo-urls.js';
export { runQaAudit } from './qa-audit.js';
export type {
  QaAuditReport,
  QaAuditItem,
  QaCategory,
  QaPriority,
} from './qa-audit.js';
export { applyQaToProject } from './qa-apply.js';
export type { QaApplyResult, QaApplyFileChange } from './qa-result-types.js';
export { collectQaRepoSignals, evaluateQaChecks } from './qa-verify.js';
export type { QaCheckResult, QaCheckStatus, QaRepoSignals } from './qa-verify.js';
export {
  runQaSuites,
  mergeQaRunIntoChecks,
  isAllowedQaCommand,
} from './qa-run.js';
export type { QaCommandRun, QaRunBundle, QaRunKind } from './qa-run.js';
