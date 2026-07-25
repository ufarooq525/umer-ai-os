/**
 * Opt-in live gate path: submitIntake(type=perf) against cursive-generator with real Lighthouse.
 * Set UMER_PERF_LIVE=1 (and UMER_LIGHTHOUSE_BIN / CHROME_PATH).
 */
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createAuditService } from '@umer/audit';
import { createControlPlaneService } from '@umer/control-plane';
import { loadProjectRegistry, submitIntake, type ControlApiState } from './state.js';

const live = process.env.UMER_PERF_LIVE === '1';

describe.runIf(live)('live perf intake gate smoke', () => {
  it(
    'runs real Lighthouse through submitIntake and creates gate-perf-* with humanRequired',
    async () => {
      const lhBin = join(tmpdir(), 'umer-lh-install', 'node_modules', '.bin', 'lighthouse.cmd');
      process.env.UMER_LIGHTHOUSE_BIN = process.env.UMER_LIGHTHOUSE_BIN || lhBin;
      process.env.CHROME_PATH =
        process.env.CHROME_PATH ||
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
      delete process.env.UMER_PERF_SKIP_LIGHTHOUSE;
      delete process.env.UMER_PERF_FIXTURE_METRICS;

      const projectRegistry = await loadProjectRegistry();
      const state: ControlApiState = {
        projectRegistry,
        workPackages: [],
        intakes: [],
        auditService: createAuditService(),
        controlPlane: null as unknown as ControlApiState['controlPlane'],
      };
      state.controlPlane = createControlPlaneService({
        workPackagesAwaitingReview: () =>
          state.workPackages.filter((wp) => wp.status === 'AwaitingReview').length,
      });

      const record = await submitIntake(state, {
        projectId: 'cursive-generator',
        type: 'perf',
        goal: 'Live performance gate-path verification against production landing page',
        doneWhen: 'Lab findings create a mandatory human gate when elevated',
      });

      const pending = await state.controlPlane.listPending();
      const gate = pending.find((item) => item.gateId === 'gate-perf-cursive-generator');

      console.log(
        'LIVE_PERF_GATE_RESULT',
        JSON.stringify(
          {
            project: record.plan.projectId,
            category: record.plan.category,
            autoApplyEng: projectRegistry.requireActive('cursive-generator').autoApplyEng,
            lighthouseRan: record.plan.perfAudit?.lighthouseRan,
            metrics: record.plan.perfAudit?.metrics,
            severityCounts: record.plan.perfAudit?.severityCounts,
            forcesGate: record.plan.perfAudit?.forcesGate,
            findings: record.plan.perfAudit?.findings.map((f) => ({
              id: f.id,
              severity: f.severity,
              metric: f.metric,
              evidence: f.evidence,
            })),
            gate: gate && {
              gateId: gate.gateId,
              humanRequired: gate.humanRequired,
              stageFrom: gate.stageFrom,
              status: gate.status,
            },
          },
          null,
          2,
        ),
      );

      expect(record.plan.perfAudit?.specialistId).toBe('perf.optimize');
      expect(record.plan.perfAudit?.lighthouseRan).toBe(true);
      expect(record.plan.perfAudit?.metrics.performanceScore).not.toBeNull();
      expect(record.plan.perfAudit?.proposedDiff).toBe('');
      expect(gate?.gateId).toBe('gate-perf-cursive-generator');
      expect(gate?.humanRequired).toBe(true);
      // Do not Pass — leave the waiting gate; evidence seals only on Pass.
    },
    300_000,
  );
});
