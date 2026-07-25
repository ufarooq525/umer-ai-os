import type { EngTestPlanItem } from './eng-delivery.js';
import type { QaRepoSignals } from './qa-verify.js';
import type { QaCommandRun, QaRunBundle } from './qa-run.js';

export type EngApplyFileChange = {
  path: string;
  action: 'created' | 'updated' | 'verified' | 'reverted';
  note: string;
};

export type EngApplyResult = {
  projectId: string;
  absolutePath: string;
  runId: string;
  appliedAt: string;
  /** Evidence root, repo-relative: `.umer/eng/<runId>`. */
  evidenceDir: string;
  files: EngApplyFileChange[];
  /** Project source files the change-set actually wrote (repo-relative). */
  changedFiles: string[];
  verifiedExisting: string[];
  stillManual: EngTestPlanItem[];
  summary: string;
  diffApplied: boolean;
  reverted: boolean;
  revertReason?: string;
  signals?: QaRepoSignals;
  recommendedCommand?: string;
  runs?: QaCommandRun[];
  runBundle?: QaRunBundle;
};
