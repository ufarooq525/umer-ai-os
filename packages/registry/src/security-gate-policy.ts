/**
 * Security gate policy (v1 — report-only findings, never auto-apply/dismiss).
 *
 * ORDER MATTERS (severity before category):
 * 1. critical/high → human gate full stop. Category and autoApplyEng are NOT consulted.
 * 2. medium/low only → fall through to category-driven rules (still human in v1).
 *
 * Never reverse this order in gate-creation callers — a permissive category branch
 * must not run before the severity check.
 */

import type { ProjectCategory } from './types.js';
import type { SecurityFinding, SecuritySeverity } from './security-audit.js';

export type SecurityGateDecision = {
  humanRequired: boolean;
  /** Always false in v1 — security findings are never auto-applied or auto-dismissed. */
  autoApply: false;
  /** True when critical/high findings elevate the gate beyond normal category rules. */
  forcedBySeverity: boolean;
  reason: string;
};

const ELEVATED: SecuritySeverity[] = ['critical', 'high'];

export function hasElevatedSecurityFindings(findings: SecurityFinding[]): boolean {
  return findings.some((f) => ELEVATED.includes(f.severity));
}

/**
 * Category-driven rules for medium/low only. Callers must not invoke this when
 * elevated findings exist — use {@link decideSecurityGate} which enforces order.
 */
export function decideSecurityGateByCategory(
  category: ProjectCategory | string,
): SecurityGateDecision {
  if (category === 'client-task') {
    return {
      humanRequired: true,
      autoApply: false,
      forcedBySeverity: false,
      reason: 'client-task always requires human gate for security findings (medium/low)',
    };
  }

  if (category === 'seo-project') {
    return {
      humanRequired: true,
      autoApply: false,
      forcedBySeverity: false,
      reason: 'seo-project security findings require human acknowledgment (medium/low)',
    };
  }

  if (category === 'digital-product') {
    return {
      humanRequired: true,
      autoApply: false,
      forcedBySeverity: false,
      reason:
        'digital-product medium/low security findings still require human acknowledgment in v1 (security never auto-applies)',
    };
  }

  return {
    humanRequired: true,
    autoApply: false,
    forcedBySeverity: false,
    reason: `unknown category "${category}" — fail closed to human gate`,
  };
}

export function decideSecurityGate(input: {
  category: ProjectCategory | string;
  findings: SecurityFinding[];
}): SecurityGateDecision {
  // 1) Severity first — return immediately; do not read category / autoApplyEng.
  if (hasElevatedSecurityFindings(input.findings)) {
    return {
      humanRequired: true,
      autoApply: false,
      forcedBySeverity: true,
      reason:
        'critical/high security findings force an explicit human gate (never skipped by category or autoApplyEng)',
    };
  }

  // 2) Medium/low (or empty) — category rules only after severity clears.
  return decideSecurityGateByCategory(input.category);
}
