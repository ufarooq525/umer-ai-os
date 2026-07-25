/**
 * Performance gate policy (v1 — report-only, never auto-apply/dismiss).
 *
 * ORDER MATTERS:
 * 1. critical/high findings force a human gate before category is consulted.
 * 2. medium/low (or empty) findings fall through to category-driven policy.
 */
import type { ProjectCategory } from './types.js';
import type { PerfFinding, PerfSeverity } from './perf-audit.js';

export type PerfGateDecision = {
  humanRequired: boolean;
  autoApply: false;
  forcedBySeverity: boolean;
  reason: string;
};

const ELEVATED: PerfSeverity[] = ['critical', 'high'];

export function hasElevatedPerfFindings(findings: PerfFinding[]): boolean {
  return findings.some((finding) => ELEVATED.includes(finding.severity));
}

/** Category policy for medium/low only; use decidePerfGate for normal calls. */
export function decidePerfGateByCategory(
  category: ProjectCategory | string,
): PerfGateDecision {
  if (category === 'client-task') {
    return {
      humanRequired: true,
      autoApply: false,
      forcedBySeverity: false,
      reason: 'client-task requires human gate for performance findings (medium/low)',
    };
  }

  if (category === 'seo-project') {
    return {
      humanRequired: true,
      autoApply: false,
      forcedBySeverity: false,
      reason: 'seo-project performance findings require human acknowledgment (medium/low)',
    };
  }

  if (category === 'digital-product') {
    return {
      humanRequired: true,
      autoApply: false,
      forcedBySeverity: false,
      reason:
        'digital-product medium/low performance findings require human acknowledgment in v1 (perf never auto-applies)',
    };
  }

  return {
    humanRequired: true,
    autoApply: false,
    forcedBySeverity: false,
    reason: `unknown category "${category}" — fail closed to human gate`,
  };
}

export function decidePerfGate(input: {
  category: ProjectCategory | string;
  findings: PerfFinding[];
}): PerfGateDecision {
  // Severity first: do not inspect category when elevated findings exist.
  if (hasElevatedPerfFindings(input.findings)) {
    return {
      humanRequired: true,
      autoApply: false,
      forcedBySeverity: true,
      reason:
        'critical/high performance findings force an explicit human gate (never skipped by category or autoApplyEng)',
    };
  }

  return decidePerfGateByCategory(input.category);
}
