import { afterEach, describe, expect, it } from 'vitest';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  buildPerfFindings,
  runPerfAudit,
  type PerfAuditReport,
  type PerfFinding,
  type PerfMetrics,
} from './perf-audit.js';
import {
  decidePerfGate,
  hasElevatedPerfFindings,
} from './perf-gate-policy.js';
import { applyPerfToProject } from './perf-apply.js';
import type { ResolvedProject } from './types.js';

const PASSING_METRICS: PerfMetrics = {
  performanceScore: 0.95,
  lcpMs: 2_000,
  cls: 0.05,
  inpMs: 150,
  fidMs: null,
  tbtMs: 80,
};

function fakeProject(root: string): ResolvedProject {
  return {
    projectId: 'demo',
    name: 'Demo',
    slug: 'demo',
    path: 'demo',
    status: 'active',
    category: 'digital-product',
    stack: ['frontend'],
    defaultSpecialists: ['perf.optimize'],
    constraints: [],
    tags: [],
    absolutePath: root,
    autoApplyEng: true,
    seoBaseUrl: 'https://example.com',
  };
}

afterEach(() => {
  delete process.env.UMER_PERF_SKIP_LIGHTHOUSE;
});

describe('buildPerfFindings', () => {
  it('uses standard critical/high Core Web Vitals thresholds', () => {
    const findings = buildPerfFindings(
      {
        performanceScore: 0.42,
        lcpMs: 4_001,
        cls: 0.2,
        inpMs: 501,
        fidMs: 101,
        tbtMs: 800,
      },
      { lighthouseRan: true },
    );

    expect(findings.find((finding) => finding.metric === 'performance-score')?.severity).toBe(
      'critical',
    );
    expect(findings.find((finding) => finding.metric === 'lcp')?.severity).toBe('critical');
    expect(findings.find((finding) => finding.metric === 'cls')?.severity).toBe('high');
    expect(findings.find((finding) => finding.metric === 'inp')?.severity).toBe('critical');
    expect(findings.find((finding) => finding.metric === 'fid')?.severity).toBe('high');
  });

  it('returns no finding when all measured values pass', () => {
    expect(buildPerfFindings(PASSING_METRICS, { lighthouseRan: true })).toEqual([]);
  });

  it('reports unavailable interaction data explicitly', () => {
    const findings = buildPerfFindings(
      { ...PASSING_METRICS, inpMs: null, fidMs: null },
      { lighthouseRan: true },
    );
    expect(findings).toEqual([
      expect.objectContaining({
        id: 'perf-interaction-metric-unavailable',
        severity: 'low',
      }),
    ]);
  });
});

describe('decidePerfGate', () => {
  const critical: PerfFinding = {
    id: 'critical-lcp',
    category: 'core-web-vital',
    metric: 'lcp',
    severity: 'critical',
    title: 'Critical LCP',
    detail: 'LCP > 4s',
    evidence: 'lcp=4500ms',
    remediation: 'Optimize LCP resource',
  };

  it('checks elevated severity before consulting category', () => {
    const input = Object.defineProperty(
      { findings: [critical] },
      'category',
      {
        get() {
          throw new Error('category must not be read for elevated findings');
        },
      },
    ) as { category: string; findings: PerfFinding[] };

    const decision = decidePerfGate(input);
    expect(decision.humanRequired).toBe(true);
    expect(decision.autoApply).toBe(false);
    expect(decision.forcedBySeverity).toBe(true);
    expect(hasElevatedPerfFindings([critical])).toBe(true);
  });

  it('falls through to category policy for medium/low only', () => {
    const low = { ...critical, severity: 'low' as const };
    const decision = decidePerfGate({
      category: 'digital-product',
      findings: [low],
    });
    expect(decision.humanRequired).toBe(true);
    expect(decision.forcedBySeverity).toBe(false);
  });
});

describe('runPerfAudit + applyPerfToProject', () => {
  it('stays report-only before Pass and seals .umer/perf/<runId> evidence after Pass', async () => {
    process.env.UMER_PERF_SKIP_LIGHTHOUSE = '1';
    const root = await mkdtemp(join(tmpdir(), 'umer-perf-'));
    try {
      const project = fakeProject(root);
      const skipped = await runPerfAudit({
        project,
        goal: 'Audit landing-page performance',
        runId: 'perf-demo-test1',
      });

      expect(skipped.specialistId).toBe('perf.optimize');
      expect(skipped.proposedDiff).toBe('');
      expect(skipped.findings[0]?.id).toBe('perf-measurement-unavailable');
      await expect(access(join(root, '.umer'))).rejects.toThrow();

      const metrics: PerfMetrics = {
        performanceScore: 0.42,
        lcpMs: 4_500,
        cls: 0.08,
        inpMs: null,
        fidMs: 350,
        tbtMs: 900,
      };
      const findings = buildPerfFindings(metrics, { lighthouseRan: true });
      const report: PerfAuditReport = {
        ...skipped,
        metrics,
        findings,
        severityCounts: {
          critical: findings.filter((finding) => finding.severity === 'critical').length,
          high: findings.filter((finding) => finding.severity === 'high').length,
          medium: findings.filter((finding) => finding.severity === 'medium').length,
          low: findings.filter((finding) => finding.severity === 'low').length,
        },
        forcesGate: true,
        gateDecision: decidePerfGate({ category: project.category, findings }),
        lighthouseRan: true,
        lighthouseNote: 'fixture Lighthouse report',
        lighthouseReport: {
          categories: { performance: { score: 0.42 } },
          audits: { 'largest-contentful-paint': { numericValue: 4_500 } },
        },
      };

      const applied = await applyPerfToProject({
        project,
        report,
        rationale: 'Reviewed elevated performance findings',
      });

      expect(applied.evidenceDir).toBe('.umer/perf/perf-demo-test1');
      expect(applied.forcesGate).toBe(true);
      const findingsJson = JSON.parse(
        await readFile(
          join(root, '.umer', 'perf', 'perf-demo-test1', 'evidence', 'findings.json'),
          'utf8',
        ),
      ) as { metrics: PerfMetrics; forcesGate: boolean };
      expect(findingsJson.metrics.lcpMs).toBe(4_500);
      expect(findingsJson.forcesGate).toBe(true);
      expect(
        JSON.parse(
          await readFile(
            join(root, '.umer', 'perf', 'perf-demo-test1', 'evidence', 'lighthouse.json'),
            'utf8',
          ),
        ),
      ).toMatchObject({ categories: { performance: { score: 0.42 } } });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
