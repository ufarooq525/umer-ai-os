import type { ResolvedProject } from './types.js';
import { runSecurityScans } from './security-scan.js';
import {
  decideSecurityGate,
  hasElevatedSecurityFindings,
  type SecurityGateDecision,
} from './security-gate-policy.js';

export type SecuritySeverity = 'critical' | 'high' | 'medium' | 'low';

export type SecurityFindingCategory = 'dependency' | 'secret' | 'auth';

/**
 * One static security finding. Report-only in v1 — no proposedDiff / auto-fix.
 */
export type SecurityFinding = {
  id: string;
  category: SecurityFindingCategory;
  severity: SecuritySeverity;
  title: string;
  detail: string;
  /** Short machine/human evidence string (command, path:line, snippet ref). */
  evidence: string;
  /** Repo-relative path when applicable. */
  path?: string;
  remediation: string;
};

export type SecurityAuditReport = {
  specialistId: 'security.review';
  runId: string;
  projectId: string;
  projectName: string;
  absolutePath: string;
  goal: string;
  summary: string;
  findings: SecurityFinding[];
  /** Counts by severity. */
  severityCounts: Record<SecuritySeverity, number>;
  /**
   * True when any critical/high finding is present — gate must be human regardless
   * of project category / autoApplyEng.
   */
  forcesGate: boolean;
  gateDecision: SecurityGateDecision;
  /** Always empty in v1 — security findings are not auto-fixed. */
  proposedDiff: '';
  dependencyCommandsRan: string[];
  dependencyCommandsSkipped: string[];
  quickWins: string[];
  nextActions: string[];
};

export function securityRunId(projectId: string, at: Date = new Date()): string {
  const stamp = at.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  return `sec-${projectId}-${stamp}`;
}

function countSeverities(findings: SecurityFinding[]): Record<SecuritySeverity, number> {
  const counts: Record<SecuritySeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  for (const f of findings) counts[f.severity] += 1;
  return counts;
}

/**
 * security.review runner (v1 — static checks only).
 *
 * Produces a report-only work package: dependency audits (npm/composer), exposed
 * secret patterns, and auth-middleware inconsistency on route files.
 * Does not mutate the Laragon project tree (same staging doctrine as eng: nothing
 * applied until an explicit human gate Pass seals evidence).
 */
export async function runSecurityAudit(input: {
  project: ResolvedProject;
  goal: string;
  doneWhen?: string;
  /** Override for deterministic evidence paths in tests. */
  runId?: string;
}): Promise<SecurityAuditReport> {
  const root = input.project.absolutePath;
  const runId = input.runId?.trim() || securityRunId(input.project.projectId);

  const scan = await runSecurityScans(root);
  const findings = scan.findings;
  const severityCounts = countSeverities(findings);
  const forcesGate = hasElevatedSecurityFindings(findings);
  const gateDecision = decideSecurityGate({
    category: input.project.category,
    findings,
  });

  const elevated = severityCounts.critical + severityCounts.high;
  const summary =
    findings.length === 0
      ? `security.review ${runId} for ${input.project.name}: no static findings.`
      : `security.review ${runId} for ${input.project.name}: ${findings.length} finding(s) (critical=${severityCounts.critical} high=${severityCounts.high} medium=${severityCounts.medium} low=${severityCounts.low})${forcesGate ? ' — human gate forced' : ''}.`;

  const quickWins =
    findings.length === 0
      ? ['No static findings this run — keep dependency audits in CI']
      : [
          ...findings
            .filter((f) => f.severity === 'critical' || f.severity === 'high')
            .slice(0, 3)
            .map((f) => f.title),
          'Rotate any exposed credentials before treating the gate as Pass',
          'Do not expect auto-fix — security v1 is report-only',
        ];

  return {
    specialistId: 'security.review',
    runId,
    projectId: input.project.projectId,
    projectName: input.project.name,
    absolutePath: root,
    goal: input.goal,
    summary,
    findings,
    severityCounts,
    forcesGate,
    gateDecision,
    proposedDiff: '',
    dependencyCommandsRan: scan.dependencyRan,
    dependencyCommandsSkipped: scan.dependencySkipped,
    quickWins: [...new Set(quickWins)],
    nextActions: [
      `Work in ${root}`,
      forcesGate
        ? 'Critical/high findings present — explicit human gate required (category/autoApplyEng cannot skip)'
        : 'Review medium/low findings; human gate still required for acknowledgment in v1',
      elevated > 0
        ? 'Clear or accept-with-rationale every critical/high item before release'
        : 'No elevated findings — still seal evidence on Pass',
      input.doneWhen?.trim() || 'Findings reviewed; evidence sealed under .umer/security/<runId>/',
      'Handoff remediations to eng.app-delivery as separate feature/bug intakes (no security auto-fix)',
    ],
  };
}
