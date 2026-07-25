import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import type { Server } from 'node:http';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createAuditService } from '@umer/audit';
import { createControlPlaneService } from '@umer/control-plane';
import { createProjectRegistry } from '@umer/registry';
import { createControlApiServer } from './server.js';
import { submitIntake, type ControlApiState } from './state.js';

/** Matches the live cursive-generator lab run shape (score high + FID critical). */
const LIVE_LIKE_METRICS = {
  performanceScore: 0.7,
  lcpMs: 2216.9,
  cls: 0,
  inpMs: null,
  fidMs: 659,
  tbtMs: 755,
};

async function request(
  server: Server,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('server not listening');
  }
  const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, json: (await response.json()) as Record<string, unknown> };
}

async function createPerfFixture(): Promise<{
  state: ControlApiState;
  productDir: string;
  cleanup: () => Promise<void>;
}> {
  const root = await mkdtemp(join(tmpdir(), 'umer-ctrl-perf-'));
  const projectsRoot = join(root, 'www');
  const productDir = join(projectsRoot, 'demo-perf');
  const catalogPath = join(root, 'catalog.json');

  await mkdir(productDir, { recursive: true });
  await writeFile(join(productDir, 'index.html'), '<!doctype html><title>Perf Demo</title>', 'utf8');

  const catalog = {
    version: '1.0.0-test',
    projectsRootEnv: 'UMER_PROJECTS_ROOT',
    defaultProjectsRoot: projectsRoot,
    projects: [
      {
        projectId: 'demo-perf',
        name: 'Demo Perf',
        slug: 'demo-perf',
        path: 'demo-perf',
        status: 'active',
        category: 'digital-product',
        stack: ['frontend'],
        defaultSpecialists: ['pm.intake', 'perf.optimize'],
        constraints: [],
        tags: [],
        autoApplyEng: true,
        seoBaseUrl: 'https://www.cursive-font-generator.com',
      },
    ],
  };
  await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');

  const projectRegistry = await createProjectRegistry({
    catalogPath,
    env: { UMER_PROJECTS_ROOT: projectsRoot },
  });

  const state: ControlApiState = {
    workPackages: [],
    intakes: [],
    auditService: createAuditService(),
    projectRegistry,
    controlPlane: null as unknown as ControlApiState['controlPlane'],
  };
  state.controlPlane = createControlPlaneService({
    workPackagesAwaitingReview: () =>
      state.workPackages.filter((wp) => wp.status === 'AwaitingReview').length,
  });

  return {
    state,
    productDir,
    cleanup: async () => {
      await rm(root, { recursive: true, force: true });
    },
  };
}

describe('perf intake gate (HTTP)', () => {
  let fixture: Awaited<ReturnType<typeof createPerfFixture>>;
  let server: Server;
  const prevFixture = process.env.UMER_PERF_FIXTURE_METRICS;
  const prevSkip = process.env.UMER_PERF_SKIP_LIGHTHOUSE;

  beforeEach(async () => {
    process.env.UMER_PERF_FIXTURE_METRICS = JSON.stringify(LIVE_LIKE_METRICS);
    delete process.env.UMER_PERF_SKIP_LIGHTHOUSE;
    fixture = await createPerfFixture();
    server = createControlApiServer(fixture.state);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    await fixture.cleanup();
    if (prevFixture === undefined) delete process.env.UMER_PERF_FIXTURE_METRICS;
    else process.env.UMER_PERF_FIXTURE_METRICS = prevFixture;
    if (prevSkip === undefined) delete process.env.UMER_PERF_SKIP_LIGHTHOUSE;
    else process.env.UMER_PERF_SKIP_LIGHTHOUSE = prevSkip;
  });

  it('creates gate-perf-* with humanRequired for elevated findings even when autoApplyEng=true', async () => {
    const intake = await request(server, 'POST', '/v1/intake', {
      projectId: 'demo-perf',
      type: 'perf',
      goal: 'Lab performance gate-path verification',
      doneWhen: 'Elevated findings create a mandatory human gate',
    });
    expect(intake.status).toBe(201);

    const plan = intake.json.plan as {
      perfAudit?: {
        specialistId: string;
        forcesGate: boolean;
        proposedDiff: string;
        findings: Array<{ severity: string; metric: string }>;
        metrics: { performanceScore: number | null; fidMs: number | null };
      };
      engDelivery?: unknown;
      category: string;
    };

    expect(plan.perfAudit?.specialistId).toBe('perf.optimize');
    expect(plan.engDelivery).toBeUndefined();
    expect(plan.perfAudit?.proposedDiff).toBe('');
    expect(plan.category).toBe('digital-product');
    expect(plan.perfAudit?.forcesGate).toBe(true);
    expect(plan.perfAudit?.metrics.performanceScore).toBe(0.7);
    expect(plan.perfAudit?.metrics.fidMs).toBe(659);
    expect(plan.perfAudit?.findings.some((f) => f.severity === 'critical')).toBe(true);

    const pending = await request(server, 'GET', '/v1/gates/pending');
    const perfGate = (
      pending.json.gates as Array<{
        waitId: string;
        gateId: string;
        humanRequired: boolean;
      }>
    ).find((g) => g.gateId.startsWith('gate-perf-'));

    expect(perfGate).toBeTruthy();
    expect(perfGate!.gateId).toBe('gate-perf-demo-perf');
    expect(perfGate!.humanRequired).toBe(true);

    const { status, json } = await request(server, 'POST', `/v1/gates/${perfGate!.waitId}/resolve`, {
      decision: 'Pass',
      approver: 'human.approver',
      rationale: 'Acknowledged lab performance findings; remediations tracked separately',
    });
    expect(status).toBe(200);

    const applyResult = json.applyResult as {
      evidenceDir?: string;
      findingCount?: number;
    } | null;
    expect(applyResult?.evidenceDir).toMatch(/^\.umer\/perf\/perf-demo-perf-/);
    expect(applyResult?.findingCount).toBeGreaterThan(0);

    const runId = applyResult!.evidenceDir!.replace('.umer/perf/', '');
    const findingsMd = await readFile(
      join(fixture.productDir, '.umer', 'perf', runId, 'FINDINGS.md'),
      'utf8',
    );
    expect(findingsMd).toContain('perf.optimize');
    expect(findingsMd).toContain('critical');
  });
});

describe('submitIntake perf gate (state-level)', () => {
  let fixture: Awaited<ReturnType<typeof createPerfFixture>>;
  const prevFixture = process.env.UMER_PERF_FIXTURE_METRICS;

  beforeEach(async () => {
    process.env.UMER_PERF_FIXTURE_METRICS = JSON.stringify(LIVE_LIKE_METRICS);
    fixture = await createPerfFixture();
  });

  afterEach(async () => {
    await fixture.cleanup();
    if (prevFixture === undefined) delete process.env.UMER_PERF_FIXTURE_METRICS;
    else process.env.UMER_PERF_FIXTURE_METRICS = prevFixture;
  });

  it('severity-first: elevated findings force humanRequired even on digital-product+autoApplyEng', async () => {
    const record = await submitIntake(fixture.state, {
      projectId: 'demo-perf',
      type: 'perf',
      goal: 'Confirm critical/high cannot be skipped by category',
    });

    expect(record.plan.perfAudit?.forcesGate).toBe(true);
    const pending = await fixture.state.controlPlane.listPending();
    const gate = pending.find((g) => g.gateId === 'gate-perf-demo-perf');
    expect(gate).toBeTruthy();
    expect(gate!.humanRequired).toBe(true);
  });
});
