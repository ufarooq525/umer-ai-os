import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { ResolvedProject } from './types.js';
import {
  runLighthouseEvidence,
  type LighthouseEvidence,
} from './seo-lighthouse.js';
import {
  decidePerfGate,
  hasElevatedPerfFindings,
  type PerfGateDecision,
} from './perf-gate-policy.js';

export type PerfSeverity = 'critical' | 'high' | 'medium' | 'low';
export type PerfFindingCategory = 'score' | 'core-web-vital' | 'measurement';
export type PerfMetricName = 'performance-score' | 'lcp' | 'cls' | 'inp' | 'fid';

export type PerfFinding = {
  id: string;
  category: PerfFindingCategory;
  metric: PerfMetricName;
  severity: PerfSeverity;
  title: string;
  detail: string;
  evidence: string;
  remediation: string;
};

export type PerfMetrics = {
  /** Lighthouse category score normalized to 0..1, matching SEO evidence. */
  performanceScore: number | null;
  lcpMs: number | null;
  cls: number | null;
  inpMs: number | null;
  /** Lighthouse lab fallback: max-potential-fid, not field FID. */
  fidMs: number | null;
  /** Captured as an interaction diagnostic when INP/FID is unavailable. */
  tbtMs: number | null;
};

export type PerfAuditReport = {
  specialistId: 'perf.optimize';
  runId: string;
  projectId: string;
  projectName: string;
  absolutePath: string;
  goal: string;
  targetUrl: string | null;
  summary: string;
  findings: PerfFinding[];
  severityCounts: Record<PerfSeverity, number>;
  metrics: PerfMetrics;
  forcesGate: boolean;
  gateDecision: PerfGateDecision;
  proposedDiff: '';
  lighthouseRan: boolean;
  lighthouseNote: string;
  lighthouseReport?: Record<string, unknown>;
  quickWins: string[];
  nextActions: string[];
};

export const PERF_THRESHOLDS = {
  performanceScore: { good: 0.9, poor: 0.5 },
  lcpMs: { good: 2_500, poor: 4_000 },
  cls: { good: 0.1, poor: 0.25 },
  inpMs: { good: 200, poor: 500 },
  fidMs: { good: 100, poor: 300 },
} as const;

export function perfRunId(projectId: string, at: Date = new Date()): string {
  const stamp = at.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  return `perf-${projectId}-${stamp}`;
}

export function resolvePerfTargetUrl(project: ResolvedProject): string | null {
  const projectKey = project.projectId.replace(/-/g, '_').toUpperCase();
  const candidates = [
    process.env[`UMER_PERF_BASE_URL_${projectKey}`],
    process.env.UMER_PERF_BASE_URL,
    project.seoBaseUrl,
    project.seoLocalUrl,
    project.qaLocalUrl,
  ];
  return candidates.find((candidate) => Boolean(candidate?.trim()))?.trim() ?? null;
}

function metricFinding(input: {
  id: string;
  metric: PerfMetricName;
  severity: PerfSeverity;
  title: string;
  detail: string;
  evidence: string;
  remediation: string;
  category?: PerfFindingCategory;
}): PerfFinding {
  return {
    id: input.id,
    category: input.category ?? 'core-web-vital',
    metric: input.metric,
    severity: input.severity,
    title: input.title,
    detail: input.detail,
    evidence: input.evidence,
    remediation: input.remediation,
  };
}

/**
 * Convert Lighthouse metrics into severity-tagged findings.
 * Standard CWV boundaries: LCP 2.5s/4s, CLS 0.1/0.25,
 * INP 200ms/500ms, and legacy FID 100ms/300ms.
 */
export function buildPerfFindings(
  metrics: PerfMetrics,
  context?: { lighthouseRan?: boolean; note?: string },
): PerfFinding[] {
  const findings: PerfFinding[] = [];

  if (!context?.lighthouseRan) {
    findings.push(
      metricFinding({
        id: 'perf-measurement-unavailable',
        category: 'measurement',
        metric: 'performance-score',
        severity: 'medium',
        title: 'Performance measurement unavailable',
        detail: 'Lighthouse did not produce a usable performance report.',
        evidence: context?.note ?? 'Lighthouse did not run',
        remediation:
          'Configure a reachable target URL and Chrome/Lighthouse, then rerun perf.optimize.',
      }),
    );
    return findings;
  }

  const score = metrics.performanceScore;
  if (score !== null && score < PERF_THRESHOLDS.performanceScore.good) {
    const severity: PerfSeverity =
      score < PERF_THRESHOLDS.performanceScore.poor ? 'critical' : 'high';
    findings.push(
      metricFinding({
        id: 'perf-overall-score',
        category: 'score',
        metric: 'performance-score',
        severity,
        title: 'Lighthouse performance score below passing threshold',
        detail: `Performance score ${(score * 100).toFixed(0)}/100 is below 90/100.`,
        evidence: `performanceScore=${score}`,
        remediation:
          'Review Lighthouse opportunities and diagnostics; prioritize render-blocking and main-thread bottlenecks.',
      }),
    );
  }

  const lcp = metrics.lcpMs;
  if (lcp !== null && lcp > PERF_THRESHOLDS.lcpMs.good) {
    const severity: PerfSeverity = lcp > PERF_THRESHOLDS.lcpMs.poor ? 'critical' : 'high';
    findings.push(
      metricFinding({
        id: 'perf-lcp',
        metric: 'lcp',
        severity,
        title: 'Largest Contentful Paint exceeds threshold',
        detail: `LCP ${(lcp / 1000).toFixed(2)}s exceeds the 2.5s passing threshold.`,
        evidence: `largest-contentful-paint=${lcp.toFixed(0)}ms`,
        remediation:
          'Optimize the LCP resource, server response, render-blocking assets, and above-fold delivery.',
      }),
    );
  }

  const cls = metrics.cls;
  if (cls !== null && cls > PERF_THRESHOLDS.cls.good) {
    const severity: PerfSeverity = cls > PERF_THRESHOLDS.cls.poor ? 'critical' : 'high';
    findings.push(
      metricFinding({
        id: 'perf-cls',
        metric: 'cls',
        severity,
        title: 'Cumulative Layout Shift exceeds threshold',
        detail: `CLS ${cls.toFixed(3)} exceeds the 0.1 passing threshold.`,
        evidence: `cumulative-layout-shift=${cls}`,
        remediation:
          'Reserve media/ad space, stabilize font loading, and avoid injecting content above existing UI.',
      }),
    );
  }

  const inp = metrics.inpMs;
  if (inp !== null && inp > PERF_THRESHOLDS.inpMs.good) {
    const severity: PerfSeverity = inp > PERF_THRESHOLDS.inpMs.poor ? 'critical' : 'high';
    findings.push(
      metricFinding({
        id: 'perf-inp',
        metric: 'inp',
        severity,
        title: 'Interaction to Next Paint exceeds threshold',
        detail: `INP ${inp.toFixed(0)}ms exceeds the 200ms passing threshold.`,
        evidence: `interaction-to-next-paint=${inp.toFixed(0)}ms`,
        remediation:
          'Reduce long tasks and event-handler work; defer nonessential main-thread execution.',
      }),
    );
  }

  const fid = metrics.fidMs;
  if (fid !== null && fid > PERF_THRESHOLDS.fidMs.good) {
    const severity: PerfSeverity = fid > PERF_THRESHOLDS.fidMs.poor ? 'critical' : 'high';
    findings.push(
      metricFinding({
        id: 'perf-fid',
        metric: 'fid',
        severity,
        title: 'Max Potential First Input Delay exceeds threshold',
        detail: `Lighthouse max-potential-FID ${fid.toFixed(0)}ms exceeds the legacy 100ms threshold.`,
        evidence: `max-potential-fid=${fid.toFixed(0)}ms`,
        remediation:
          'Break up long JavaScript tasks and reduce parse/evaluation work; validate with field INP data.',
      }),
    );
  }

  if (inp === null && fid === null) {
    findings.push(
      metricFinding({
        id: 'perf-interaction-metric-unavailable',
        category: 'measurement',
        metric: 'inp',
        severity: 'low',
        title: 'INP/FID unavailable in the lab report',
        detail:
          'The one-shot Lighthouse report did not expose INP or max-potential-FID; field INP requires real interaction data.',
        evidence:
          metrics.tbtMs === null
            ? 'interaction metrics unavailable'
            : `total-blocking-time=${metrics.tbtMs.toFixed(0)}ms (diagnostic proxy only)`,
        remediation:
          'Collect field INP with CrUX/RUM; use Total Blocking Time only as a lab diagnostic.',
      }),
    );
  }

  return findings;
}

function countSeverities(findings: PerfFinding[]): Record<PerfSeverity, number> {
  const counts: Record<PerfSeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  for (const finding of findings) counts[finding.severity] += 1;
  return counts;
}

function toMetrics(lighthouse: LighthouseEvidence): PerfMetrics {
  return {
    performanceScore: lighthouse.performanceScore,
    lcpMs: lighthouse.lcpMs,
    cls: lighthouse.cls,
    inpMs: lighthouse.inpMs,
    fidMs: lighthouse.fidMs,
    tbtMs: lighthouse.tbtMs,
  };
}

/**
 * perf.optimize runner (v1): Lighthouse measurement + report-only findings.
 * It never writes to the project tree; evidence is sealed only after gate Pass.
 */
export async function runPerfAudit(input: {
  project: ResolvedProject;
  goal: string;
  doneWhen?: string;
  targetUrl?: string;
  runId?: string;
}): Promise<PerfAuditReport> {
  const runId = input.runId?.trim() || perfRunId(input.project.projectId);
  const targetUrl = input.targetUrl?.trim() || resolvePerfTargetUrl(input.project);

  const fixtureRaw = process.env.UMER_PERF_FIXTURE_METRICS?.trim();
  if (fixtureRaw) {
    // Test-only: inject lab metrics without launching Chrome (control-api gate tests).
    const metrics = JSON.parse(fixtureRaw) as PerfMetrics;
    const findings = buildPerfFindings(metrics, {
      lighthouseRan: true,
      note: 'UMER_PERF_FIXTURE_METRICS',
    });
    const severityCounts = countSeverities(findings);
    const forcesGate = hasElevatedPerfFindings(findings);
    const gateDecision = decidePerfGate({
      category: input.project.category,
      findings,
    });
    return {
      specialistId: 'perf.optimize',
      runId,
      projectId: input.project.projectId,
      projectName: input.project.name,
      absolutePath: input.project.absolutePath,
      goal: input.goal,
      targetUrl,
      summary: `perf.optimize ${runId} for ${input.project.name}: fixture metrics; ${findings.length} finding(s)`,
      findings,
      severityCounts,
      metrics,
      forcesGate,
      gateDecision,
      proposedDiff: '',
      lighthouseRan: true,
      lighthouseNote: 'UMER_PERF_FIXTURE_METRICS',
      quickWins: findings.slice(0, 3).map((f) => f.title),
      nextActions: [
        `Review performance evidence for ${targetUrl ?? input.project.absolutePath}`,
        forcesGate
          ? 'Critical/high findings present — explicit human gate required before category logic'
          : 'Review medium/low findings under normal category-driven gate policy',
        input.doneWhen?.trim() ||
          'Findings reviewed; evidence sealed under .umer/perf/<runId>/ after Pass',
      ],
    };
  }

  const temporaryEvidenceDir = await mkdtemp(join(tmpdir(), 'umer-perf-lh-'));
  let lighthouse: LighthouseEvidence;
  try {
    lighthouse = await runLighthouseEvidence({
      url: targetUrl ?? '',
      evidenceDir: temporaryEvidenceDir,
      enabled: Boolean(targetUrl),
      mode: 'perf',
    });
  } finally {
    // Lighthouse report is retained in-memory; do not touch the project before Pass.
    await rm(temporaryEvidenceDir, { recursive: true, force: true }).catch(() => undefined);
  }

  const metrics = toMetrics(lighthouse);
  const findings = buildPerfFindings(metrics, {
    lighthouseRan: lighthouse.ran,
    note: lighthouse.note,
  });
  const severityCounts = countSeverities(findings);
  const forcesGate = hasElevatedPerfFindings(findings);
  const gateDecision = decidePerfGate({
    category: input.project.category,
    findings,
  });

  const summary = lighthouse.ran
    ? `perf.optimize ${runId} for ${input.project.name}: score=${
        metrics.performanceScore === null
          ? 'n/a'
          : `${Math.round(metrics.performanceScore * 100)}/100`
      }, ${findings.length} finding(s) (critical=${severityCounts.critical} high=${severityCounts.high} medium=${severityCounts.medium} low=${severityCounts.low})${forcesGate ? ' — human gate forced' : ''}.`
    : `perf.optimize ${runId} for ${input.project.name}: measurement unavailable; ${lighthouse.note}`;

  const quickWins =
    findings.length === 0
      ? ['Core Web Vitals and Lighthouse performance score pass v1 thresholds']
      : [
          ...findings
            .filter((finding) => finding.severity === 'critical' || finding.severity === 'high')
            .slice(0, 3)
            .map((finding) => finding.title),
          'Use the Lighthouse report to prioritize the largest measured bottlenecks',
          'Do not expect auto-fix — perf v1 is report-only',
        ];

  return {
    specialistId: 'perf.optimize',
    runId,
    projectId: input.project.projectId,
    projectName: input.project.name,
    absolutePath: input.project.absolutePath,
    goal: input.goal,
    targetUrl,
    summary,
    findings,
    severityCounts,
    metrics,
    forcesGate,
    gateDecision,
    proposedDiff: '',
    lighthouseRan: lighthouse.ran,
    lighthouseNote: lighthouse.note,
    lighthouseReport: lighthouse.report,
    quickWins: [...new Set(quickWins)],
    nextActions: [
      `Review performance evidence for ${targetUrl ?? input.project.absolutePath}`,
      forcesGate
        ? 'Critical/high findings present — explicit human gate required before category logic'
        : 'Review medium/low findings under normal category-driven gate policy',
      input.doneWhen?.trim() ||
        'Findings reviewed; evidence sealed under .umer/perf/<runId>/ after Pass',
      'Handoff remediation as a separate eng.app-delivery intake (no perf auto-fix in v1)',
    ],
  };
}
