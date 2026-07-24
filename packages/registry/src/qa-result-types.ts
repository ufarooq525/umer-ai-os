import type { QaAuditItem } from './qa-audit.js';
import type { QaCheckResult, QaRepoSignals } from './qa-verify.js';
import type { QaCommandRun, QaRunBundle } from './qa-run.js';

export type QaApplyFileChange = {
  path: string;
  action: 'created' | 'updated' | 'verified';
  note: string;
};

export type QaApplyResult = {
  projectId: string;
  absolutePath: string;
  appliedAt: string;
  files: QaApplyFileChange[];
  verifiedExisting: string[];
  stillManual: QaAuditItem[];
  summary: string;
  checks?: QaCheckResult[];
  signals?: QaRepoSignals;
  patchedItemIds?: string[];
  recommendedCommand?: string;
  runs?: QaCommandRun[];
  runBundle?: QaRunBundle;
};
