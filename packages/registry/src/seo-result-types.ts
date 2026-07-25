import type { SeoAuditItem } from './seo-audit.js';
import type { SeoCheckResult } from './seo-verify.js';
import type { LighthouseEvidence } from './seo-lighthouse.js';

export type SeoApplyFileChange = {
  path: string;
  action: 'created' | 'updated' | 'verified';
  note: string;
};

export type SeoApplyResult = {
  projectId: string;
  absolutePath: string;
  appliedAt: string;
  files: SeoApplyFileChange[];
  verifiedExisting: string[];
  stillManual: SeoAuditItem[];
  summary: string;
  probeUrl?: string;
  checks?: SeoCheckResult[];
  lighthouse?: LighthouseEvidence;
  patchedItemIds?: string[];
  /** True when the work-package change-set was applied via shared scoped-apply. */
  changeSetApplied?: boolean;
};
