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
  ProjectCategory,
  ResolvedProject,
  IntakeInstruction,
  IntakePlan,
} from './types.js';
export { ProjectRegistryError, type ProjectRegistryErrorCode } from './errors.js';
export {
  ProjectCategorySchema,
  ProjectRecordSchema,
  ProjectCatalogSchema,
  IntakeInstructionSchema,
  IntakePlanSchema,
  EngChangeSetEntrySchema,
} from './schema.js';
export { resolveProjectsRoot, loadCatalogFromFile, resolveProjectPath } from './catalog.js';
export { ProjectRegistry, createProjectRegistry } from './registry.js';
export {
  planIntake,
  planIntakeWithEng,
  planIntakeWithSeo,
  planIntakeWithSecurity,
  planIntakeWithPerf,
  planIntakeWithUx,
  planIntakeForControl,
} from './intake.js';
export type { IntakePlanOptions } from './intake.js';
export { routeIntakeGoal, decideIntakeRouting, TYPE_SPECIALISTS } from './pm-routing.js';
export type {
  IntakeRouting,
  IntakeRoutingDecision,
  IntakeTaskType,
  RoutingCandidate,
  RoutingConfidence,
} from './pm-routing.js';
export {
  createManualCodeProducer,
  createScriptedCodeProducer,
  createProjectFileReader,
  buildChangeSetDraft,
  validateProducedChangeSet,
} from './code-producer.js';
export type {
  CodeProducer,
  CodeProductionRequest,
  CodeProductionOutcome,
  EngChangeSetDraft,
  EngProductionRecord,
} from './code-producer.js';
export { runSeoAudit, buildSeoAuditReport } from './seo-audit.js';
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
export { proposeSeoSafeFixes, SEO_FIX_EVIDENCE_PATHS } from './seo-diff.js';
export type { SeoFixProposal } from './seo-diff.js';
export {
  SEO_SAFE_FIX_IDS,
  SEO_REPORT_ONLY_IDS,
  isSeoSafeFixId,
  listSeoSafeFixIds,
} from './seo-fix-whitelist.js';
export type { SeoSafeFixId } from './seo-fix-whitelist.js';
export { applyScopedEdits } from './apply-scoped-edits.js';
export type { ScopedEditApplyResult, ScopedEditFileAction } from './apply-scoped-edits.js';
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
export { runEngDelivery, engRunId, captureStagedEvidence, evaluateStagedRuns } from './eng-delivery.js';
export type {
  EngDeliveryReport,
  EngDeliveryType,
  EngWorkPackageStatus,
  EngTestPlanItem,
  EngPriority,
  EngTestCategory,
  EngStagedEvidenceFile,
} from './eng-delivery.js';
export { applyEngToProject } from './eng-apply.js';
export type { EngApplyResult, EngApplyFileChange } from './eng-result-types.js';
export {
  resolveEngScope,
  isSafeProjectRelativePath,
  engMaxFiles,
  ENG_MAX_FILES_DEFAULT,
  assertSafeEngRunId,
  assertNoSymlinkInProjectPath,
} from './eng-scope.js';
export type { EngScope, EngScopeFile, EngScopeStatus } from './eng-scope.js';
export {
  resolveEngChangeSet,
  buildProposedDiff,
  contentHash,
  assertEditsStillFresh,
  summarizeEditStats,
} from './eng-diff.js';
export type {
  EngChangeSetEntry,
  EngResolvedEdit,
  EngEditResolution,
} from './eng-diff.js';
export {
  decideEngGate,
  evaluateEngAutoEligibility,
  assertEngApplyAllowed,
  engApprovalMode,
  engApprovalRationale,
} from './eng-gate-policy.js';
export type {
  EngGateDecision,
  EngGateMode,
  EngAutoEligibility,
  EngApplyApproval,
} from './eng-gate-policy.js';
export { runSecurityAudit, securityRunId } from './security-audit.js';
export type {
  SecurityAuditReport,
  SecurityFinding,
  SecurityFindingCategory,
  SecuritySeverity,
} from './security-audit.js';
export { applySecurityToProject } from './security-apply.js';
export type { SecurityApplyResult, SecurityApplyFileChange } from './security-apply.js';
export {
  runSecurityScans,
  scanDependencyVulnerabilities,
  scanExposedSecrets,
  scanAuthPermissionGaps,
  isAllowedSecurityAuditCommand,
} from './security-scan.js';
export type { SecurityScanBundle } from './security-scan.js';
export {
  decideSecurityGate,
  decideSecurityGateByCategory,
  hasElevatedSecurityFindings,
} from './security-gate-policy.js';
export type { SecurityGateDecision } from './security-gate-policy.js';
export {
  runPerfAudit,
  perfRunId,
  resolvePerfTargetUrl,
  buildPerfFindings,
  PERF_THRESHOLDS,
} from './perf-audit.js';
export type {
  PerfAuditReport,
  PerfFinding,
  PerfFindingCategory,
  PerfMetricName,
  PerfMetrics,
  PerfSeverity,
} from './perf-audit.js';
export { applyPerfToProject } from './perf-apply.js';
export type { PerfApplyResult, PerfApplyFileChange } from './perf-apply.js';
export {
  decidePerfGate,
  decidePerfGateByCategory,
  hasElevatedPerfFindings,
} from './perf-gate-policy.js';
export type { PerfGateDecision } from './perf-gate-policy.js';
export { runUxAudit, uxRunId } from './ux-audit.js';
export type {
  UxAuditReport,
  UxAuditItem,
  UxCategory,
  UxPriority,
} from './ux-audit.js';
export { applyUxToProject } from './ux-apply.js';
export type { UxApplyResult, UxApplyFileChange } from './ux-apply.js';

export {
  SpecialistRegistry,
  SpecialistRegistryError,
  createSpecialistRegistry,
} from './specialist-registry.js';
export type { SpecialistMatchQuery } from './specialist-registry.js';
