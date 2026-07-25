import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import type { Server } from 'node:http';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createAuditService } from '@umer/audit';
import { createControlPlaneService } from '@umer/control-plane';
import { createEventBus } from '@umer/event-bus';
import { createProjectRegistry } from '@umer/registry';
import { createControlApiServer } from './server.js';
import { registerQaBusShim, submitIntake, type ControlApiState } from './state.js';

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

async function createUxFixture(): Promise<{
  state: ControlApiState;
  productDir: string;
  cleanup: () => Promise<void>;
}> {
  const root = await mkdtemp(join(tmpdir(), 'umer-ctrl-ux-'));
  const projectsRoot = join(root, 'www');
  const productDir = join(projectsRoot, 'umer-portfolio');
  const catalogPath = join(root, 'catalog.json');

  await mkdir(productDir, { recursive: true });
  await writeFile(
    join(productDir, 'index.html'),
    '<!doctype html><title>Umer Portfolio</title>',
    'utf8',
  );

  const catalog = {
    version: '1.0.0-test',
    projectsRootEnv: 'UMER_PROJECTS_ROOT',
    defaultProjectsRoot: projectsRoot,
    projects: [
      {
        projectId: 'umer-portfolio',
        name: 'Umer Portfolio',
        slug: 'umer-portfolio',
        path: 'umer-portfolio',
        status: 'active',
        category: 'seo-project',
        stack: ['frontend'],
        defaultSpecialists: ['pm.intake', 'seo.audit', 'ux.design', 'perf.optimize'],
        constraints: [],
        tags: ['portfolio', 'seo', 'marketing'],
        autoApplyEng: false,
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
    bus: createEventBus(),
  };
  state.controlPlane = createControlPlaneService({
    workPackagesAwaitingReview: () =>
      state.workPackages.filter((wp) => wp.status === 'AwaitingReview').length,
  });
  registerQaBusShim(state);

  return {
    state,
    productDir,
    cleanup: async () => {
      await rm(root, { recursive: true, force: true });
    },
  };
}

describe('ux intake gate (HTTP)', () => {
  let fixture: Awaited<ReturnType<typeof createUxFixture>>;
  let server: Server;

  beforeEach(async () => {
    fixture = await createUxFixture();
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
  });

  it('creates gate-ux-* with humanRequired and seals .umer/ux/ on Pass', async () => {
    const intake = await request(server, 'POST', '/v1/intake', {
      projectId: 'umer-portfolio',
      type: 'ux',
      goal: 'UI/UX audit + improve navigation and hierarchy',
      doneWhen: 'Prioritized UX findings sealed for eng handoff',
    });
    expect(intake.status).toBe(201);

    const plan = intake.json.plan as {
      uxAudit?: {
        specialistId: string;
        runId: string;
        proposedDiff: string;
        items: Array<{ id: string; priority: string }>;
      };
      engDelivery?: unknown;
      perfAudit?: unknown;
      type: string;
    };

    expect(plan.type).toBe('ux');
    expect(plan.uxAudit?.specialistId).toBe('ux.design');
    expect(plan.uxAudit?.proposedDiff).toBe('');
    expect(plan.uxAudit?.items.length).toBeGreaterThan(10);
    expect(plan.uxAudit?.items.some((i) => i.id === 'portfolio-hero')).toBe(true);
    expect(plan.engDelivery).toBeUndefined();
    expect(plan.perfAudit).toBeUndefined();

    const pending = await request(server, 'GET', '/v1/gates/pending');
    const uxGate = (
      pending.json.gates as Array<{
        waitId: string;
        gateId: string;
        humanRequired: boolean;
      }>
    ).find((g) => g.gateId.startsWith('gate-ux-'));

    expect(uxGate).toBeTruthy();
    expect(uxGate!.gateId).toBe('gate-ux-umer-portfolio');
    expect(uxGate!.humanRequired).toBe(true);

    const { status, json } = await request(server, 'POST', `/v1/gates/${uxGate!.waitId}/resolve`, {
      decision: 'Pass',
      approver: 'human.approver',
      rationale: 'Acknowledged UX checklist; improvements tracked via eng intake',
    });
    expect(status).toBe(200);

    const applyResult = json.applyResult as {
      evidenceDir?: string;
      itemCount?: number;
    } | null;
    expect(applyResult?.evidenceDir).toMatch(/^\.umer\/ux\/ux-umer-portfolio-/);
    expect(applyResult?.itemCount).toBeGreaterThan(0);

    const runId = applyResult!.evidenceDir!.replace('.umer/ux/', '');
    const findingsMd = await readFile(
      join(fixture.productDir, '.umer', 'ux', runId, 'FINDINGS.md'),
      'utf8',
    );
    expect(findingsMd).toContain('ux.design');
    expect(findingsMd).toContain('portfolio-hero');
  });
});

describe('submitIntake ux gate (state-level)', () => {
  let fixture: Awaited<ReturnType<typeof createUxFixture>>;

  beforeEach(async () => {
    fixture = await createUxFixture();
  });

  afterEach(async () => {
    await fixture.cleanup();
  });

  it('routes type=ux to ux.design / gate-ux-* not pm.intake or perf', async () => {
    const record = await submitIntake(fixture.state, {
      projectId: 'umer-portfolio',
      type: 'ux',
      goal: 'Confirm UX does not fall through to intake or perf',
    });

    expect(record.plan.uxAudit?.specialistId).toBe('ux.design');
    expect(record.plan.perfAudit).toBeUndefined();
    expect(fixture.state.workPackages[0]?.specialistId).toBe('ux.design');
    expect(fixture.state.workPackages[0]?.stage).toBe('UX Audit');

    const pending = await fixture.state.controlPlane.listPending();
    const gate = pending.find((g) => g.gateId === 'gate-ux-umer-portfolio');
    expect(gate).toBeTruthy();
    expect(gate!.humanRequired).toBe(true);
    expect(pending.some((g) => g.gateId.startsWith('gate-intake-'))).toBe(false);
    expect(pending.some((g) => g.gateId.startsWith('gate-perf-'))).toBe(false);
  });
});
