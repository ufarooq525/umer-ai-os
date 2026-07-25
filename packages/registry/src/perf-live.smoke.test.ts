/**
 * One-shot live validation: runPerfAudit against a real URL with a local Lighthouse binary.
 * Opt-in only — set UMER_PERF_LIVE=1 (and preferably UMER_LIGHTHOUSE_BIN + CHROME_PATH).
 */
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createProjectRegistry } from './registry.js';
import { runPerfAudit, buildPerfFindings } from './perf-audit.js';
import { decidePerfGate } from './perf-gate-policy.js';
import { fileURLToPath } from 'node:url';

const live = process.env.UMER_PERF_LIVE === '1';
const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');
const catalogPath = join(repoRoot, 'projects', 'catalog.json');

describe.runIf(live)('live Lighthouse → runPerfAudit', () => {
  it(
    'extracts real metrics and severity-tags findings for cursive-generator',
    async () => {
      const lhBin = join(tmpdir(), 'umer-lh-install', 'node_modules', '.bin', 'lighthouse.cmd');
      process.env.UMER_LIGHTHOUSE_BIN = process.env.UMER_LIGHTHOUSE_BIN || lhBin;
      process.env.CHROME_PATH =
        process.env.CHROME_PATH ||
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
      delete process.env.UMER_PERF_SKIP_LIGHTHOUSE;

      const registry = await createProjectRegistry({ catalogPath });
      const project = registry.requireActive('cursive-generator');

      const report = await runPerfAudit({
        project,
        goal: 'Live Core Web Vitals lab audit before intake wiring',
        targetUrl: 'https://www.cursive-font-generator.com',
        runId: 'perf-cursive-live1',
      });

      console.log(
        'LIVE_PERF_RESULT',
        JSON.stringify(
          {
            lighthouseRan: report.lighthouseRan,
            lighthouseNote: report.lighthouseNote,
            metrics: report.metrics,
            severityCounts: report.severityCounts,
            forcesGate: report.forcesGate,
            findings: report.findings.map((f) => ({
              id: f.id,
              severity: f.severity,
              metric: f.metric,
              evidence: f.evidence,
            })),
            gate: report.gateDecision,
            proposedDiff: report.proposedDiff,
          },
          null,
          2,
        ),
      );

      expect(report.lighthouseRan).toBe(true);
      expect(report.metrics.performanceScore).not.toBeNull();
      expect(report.metrics.lcpMs).not.toBeNull();
      expect(report.metrics.cls).not.toBeNull();
      // Lab reports expose max-potential-fid, not interaction-to-next-paint.
      expect(report.metrics.fidMs).not.toBeNull();
      expect(report.proposedDiff).toBe('');

      const rebuilt = buildPerfFindings(report.metrics, {
        lighthouseRan: true,
        note: report.lighthouseNote,
      });
      expect(rebuilt.map((f) => f.id).sort()).toEqual(
        report.findings.map((f) => f.id).sort(),
      );

      const decision = decidePerfGate({
        category: 'digital-product',
        findings: report.findings,
      });
      if (report.forcesGate) {
        expect(decision.forcedBySeverity).toBe(true);
        expect(decision.humanRequired).toBe(true);
        expect(decision.autoApply).toBe(false);
      }
    },
    240_000,
  );
});
