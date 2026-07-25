import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import type { Server } from 'node:http';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createAuditService } from '@umer/audit';
import { createControlPlaneService } from '@umer/control-plane';
import { createProjectRegistry, contentHash } from '@umer/registry';
import { createControlApiServer } from './server.js';
import {
  applyEngOnGatePass,
  submitIntake,
  type ControlApiState,
} from './state.js';

const SRC_REL = 'src/hello.ts';
const SRC_BEFORE = 'export const greeting = "hello";\n';
const SRC_AFTER = 'export const greeting = "hello world";\n';

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

/**
 * Isolated control-api state backed by a temp catalog + projects root.
 * Does not touch UMER_PROJECTS_CATALOG / UMER_PROJECTS_ROOT on process.env,
 * so it cannot race with server.test.ts.
 */
async function createIsolatedFixture(): Promise<{
  state: ControlApiState;
  projectsRoot: string;
  catalogPath: string;
  clientDir: string;
  seoDir: string;
  cleanup: () => Promise<void>;
}> {
  const root = await mkdtemp(join(tmpdir(), 'umer-ctrl-eng-'));
  const projectsRoot = join(root, 'www');
  const clientDir = join(projectsRoot, 'demo-client');
  const seoDir = join(projectsRoot, 'demo-seo');
  const catalogPath = join(root, 'catalog.json');

  await mkdir(join(clientDir, 'src'), { recursive: true });
  await writeFile(join(clientDir, SRC_REL), SRC_BEFORE, 'utf8');
  await writeFile(join(clientDir, 'phpunit.xml'), '<phpunit/>', 'utf8');

  await mkdir(seoDir, { recursive: true });
  await writeFile(join(seoDir, 'index.html'), '<!doctype html><title>SEO Demo</title>', 'utf8');

  const catalog = {
    version: '1.0.0-test',
    projectsRootEnv: 'UMER_PROJECTS_ROOT',
    defaultProjectsRoot: projectsRoot,
    projects: [
      {
        projectId: 'demo-client',
        name: 'Demo Client',
        slug: 'demo-client',
        path: 'demo-client',
        status: 'active',
        category: 'client-task',
        stack: ['ts'],
        defaultSpecialists: ['pm.intake', 'eng.app-delivery'],
        constraints: [],
        tags: [],
        // autoApplyEng omitted → zod default false
      },
      {
        projectId: 'demo-seo',
        name: 'Demo SEO',
        slug: 'demo-seo',
        path: 'demo-seo',
        status: 'active',
        category: 'seo-project',
        stack: ['frontend'],
        defaultSpecialists: ['pm.intake', 'seo.audit'],
        constraints: [],
        tags: ['seo'],
        seoLocalUrl: 'http://127.0.0.1:9',
      },
    ],
  };
  await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');

  const projectRegistry = await createProjectRegistry({
    catalogPath,
    // Local env object — never mutates process.env.
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
    projectsRoot,
    catalogPath,
    clientDir,
    seoDir,
    cleanup: async () => {
      await rm(root, { recursive: true, force: true });
    },
  };
}

describe('control-api eng gate (isolated fixture)', () => {
  let fixture: Awaited<ReturnType<typeof createIsolatedFixture>>;
  let server: ReturnType<typeof createControlApiServer>;
  const prevSkipRun = process.env.UMER_QA_SKIP_RUN;
  const prevSkipLh = process.env.UMER_SEO_SKIP_LIGHTHOUSE;

  beforeEach(async () => {
    process.env.UMER_QA_SKIP_RUN = '1';
    process.env.UMER_SEO_SKIP_LIGHTHOUSE = '1';
    fixture = await createIsolatedFixture();
    server = createControlApiServer(fixture.state);
    await new Promise<void>((resolve) => server.listen(0, resolve));
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    await fixture.cleanup();
    if (prevSkipRun === undefined) delete process.env.UMER_QA_SKIP_RUN;
    else process.env.UMER_QA_SKIP_RUN = prevSkipRun;
    if (prevSkipLh === undefined) delete process.env.UMER_SEO_SKIP_LIGHTHOUSE;
    else process.env.UMER_SEO_SKIP_LIGHTHOUSE = prevSkipLh;
  });

  it('creates gate-eng-* for client-task feature intake and applies on human Pass', async () => {
    const intake = await request(server, 'POST', '/v1/intake', {
      projectId: 'demo-client',
      type: 'feature',
      goal: 'Update greeting string for client delivery',
      doneWhen: 'Source greeting says hello world',
      targetFiles: [SRC_REL],
      proposedChanges: [
        {
          path: SRC_REL,
          expectedContent: SRC_BEFORE,
          expectedHash: contentHash(SRC_BEFORE),
          content: SRC_AFTER,
          note: 'Bump greeting',
        },
      ],
    });
    expect(intake.status).toBe(201);

    const plan = intake.json.plan as {
      engDelivery?: { runId: string; status: string };
    };
    expect(plan.engDelivery?.status).toBe('ready');
    const runId = plan.engDelivery!.runId;

    // Source must stay untouched until Pass.
    expect(await readFile(join(fixture.clientDir, SRC_REL), 'utf8')).toBe(SRC_BEFORE);

    const pending = await request(server, 'GET', '/v1/gates/pending');
    const engGate = (
      pending.json.gates as Array<{
        waitId: string;
        gateId: string;
        humanRequired: boolean;
      }>
    ).find((g) => g.gateId.startsWith('gate-eng-'));

    expect(engGate).toBeTruthy();
    expect(engGate!.gateId).toBe('gate-eng-demo-client');
    expect(engGate!.humanRequired).toBe(true);
    expect(
      (pending.json.gates as { gateId: string }[]).some((g) => g.gateId.startsWith('gate-seo-')),
    ).toBe(false);

    const { status, json } = await request(server, 'POST', `/v1/gates/${engGate!.waitId}/resolve`, {
      decision: 'Pass',
      approver: 'human.approver',
      rationale: 'Approve eng change-set for demo-client',
    });
    expect(status).toBe(200);

    const applyResult = json.applyResult as {
      evidenceDir?: string;
      changedFiles?: string[];
      summary?: string;
    } | null;
    expect(applyResult?.changedFiles).toContain(SRC_REL);
    expect(applyResult?.evidenceDir).toBe(`.umer/eng/${runId}`);

    expect(await readFile(join(fixture.clientDir, SRC_REL), 'utf8')).toBe(SRC_AFTER);
    expect(
      await readFile(join(fixture.clientDir, '.umer', 'eng', runId, 'APPLY_REPORT.md'), 'utf8'),
    ).toContain('Eng apply report');
    expect(
      await readFile(join(fixture.clientDir, '.umer', 'eng', runId, 'last-apply.json'), 'utf8'),
    ).toContain('human-gate');
  });

  it('seo intake creates gate-seo-* and never constructs engDelivery or gate-eng-*', async () => {
    const intake = await request(server, 'POST', '/v1/intake', {
      projectId: 'demo-seo',
      type: 'seo',
      goal: 'Improve demo SEO landing discoverability',
      doneWhen: 'P0 SEO items reviewed',
      // Even if a caller supplies eng fields, SEO-type must ignore them.
      proposedChanges: [
        {
          path: SRC_REL,
          expectedContent: null,
          content: 'should-not-run',
        },
      ],
    });
    expect(intake.status).toBe(201);

    const plan = intake.json.plan as {
      seoAudit?: { specialistId: string };
      engDelivery?: unknown;
    };
    expect(plan.seoAudit?.specialistId).toBe('seo.audit');
    expect(plan.engDelivery).toBeUndefined();

    const pending = await request(server, 'GET', '/v1/gates/pending');
    const gates = pending.json.gates as { gateId: string }[];
    expect(gates.some((g) => g.gateId.startsWith('gate-seo-'))).toBe(true);
    expect(gates.some((g) => g.gateId.startsWith('gate-eng-'))).toBe(false);
  });
});

describe('submitIntake eng gate (state-level, isolated)', () => {
  let fixture: Awaited<ReturnType<typeof createIsolatedFixture>>;
  const prevSkipRun = process.env.UMER_QA_SKIP_RUN;

  beforeEach(async () => {
    process.env.UMER_QA_SKIP_RUN = '1';
    fixture = await createIsolatedFixture();
  });

  afterEach(async () => {
    await fixture.cleanup();
    if (prevSkipRun === undefined) delete process.env.UMER_QA_SKIP_RUN;
    else process.env.UMER_QA_SKIP_RUN = prevSkipRun;
  });

  it('human Pass path applies via applyEngOnGatePass with approver', async () => {
    const record = await submitIntake(fixture.state, {
      projectId: 'demo-client',
      type: 'bug',
      goal: 'Fix greeting via eng work package',
      targetFiles: [SRC_REL],
      proposedChanges: [
        {
          path: SRC_REL,
          expectedContent: SRC_BEFORE,
          content: SRC_AFTER,
        },
      ],
    });

    expect(record.plan.engDelivery?.specialistId).toBe('eng.app-delivery');
    expect(await readFile(join(fixture.clientDir, SRC_REL), 'utf8')).toBe(SRC_BEFORE);

    const pending = await fixture.state.controlPlane.listPending();
    const engGate = pending.find((g) => g.gateId.startsWith('gate-eng-'));
    expect(engGate?.humanRequired).toBe(true);

    const resolved = await fixture.state.controlPlane.resolveGate(
      engGate!.waitId,
      {
        decision: 'Pass',
        approver: 'human.approver',
        rationale: 'state-level eng Pass',
      },
      'corr-eng-state',
    );

    const applyResult = await applyEngOnGatePass(fixture.state, {
      workPackageId: resolved.record.workPackageId,
      gateId: resolved.record.gateId,
      rationale: 'state-level eng Pass',
      approver: 'human.approver',
    });

    expect(applyResult?.changedFiles).toContain(SRC_REL);
    expect(await readFile(join(fixture.clientDir, SRC_REL), 'utf8')).toBe(SRC_AFTER);
    expect(record.status).toBe('approved');
  });
});
