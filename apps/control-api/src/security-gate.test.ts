import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import type { Server } from 'node:http';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { createAuditService } from '@umer/audit';
import { createControlPlaneService } from '@umer/control-plane';
import { createProjectRegistry } from '@umer/registry';
import { createEventBus } from '@umer/event-bus';
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

function runNpmInstall(cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('npm', ['install', '--no-fund', '--no-audit'], {
      cwd,
      shell: true,
      windowsHide: true,
    });
    let stderr = '';
    child.stderr?.on('data', (d: Buffer) => {
      stderr += d.toString('utf8');
    });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`npm install failed (${code}): ${stderr.slice(0, 400)}`));
    });
    child.on('error', reject);
  });
}

async function createSecurityFixture(): Promise<{
  state: ControlApiState;
  productDir: string;
  cleanup: () => Promise<void>;
}> {
  const root = await mkdtemp(join(tmpdir(), 'umer-ctrl-sec-'));
  const projectsRoot = join(root, 'www');
  const productDir = join(projectsRoot, 'demo-product');
  const catalogPath = join(root, 'catalog.json');

  await mkdir(productDir, { recursive: true });
  // Known-vulnerable lodash range — npm audit should report medium+ findings.
  await writeFile(
    join(productDir, 'package.json'),
    JSON.stringify(
      {
        name: 'demo-product',
        version: '1.0.0',
        private: true,
        dependencies: {
          lodash: '4.17.15',
        },
      },
      null,
      2,
    ),
    'utf8',
  );
  await runNpmInstall(productDir);

  const catalog = {
    version: '1.0.0-test',
    projectsRootEnv: 'UMER_PROJECTS_ROOT',
    defaultProjectsRoot: projectsRoot,
    projects: [
      {
        projectId: 'demo-product',
        name: 'Demo Product',
        slug: 'demo-product',
        path: 'demo-product',
        status: 'active',
        category: 'digital-product',
        stack: ['node'],
        defaultSpecialists: ['pm.intake', 'security.review'],
        constraints: [],
        tags: [],
        // Permissive eng auto-apply must NOT skip security gates.
        autoApplyEng: true,
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

describe('security intake gate (HTTP)', () => {
  let fixture: Awaited<ReturnType<typeof createSecurityFixture>>;
  let server: Server;
  const prevSkip = process.env.UMER_SECURITY_SKIP_AUDIT;

  beforeEach(async () => {
    delete process.env.UMER_SECURITY_SKIP_AUDIT;
    fixture = await createSecurityFixture();
    server = createControlApiServer(fixture.state);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
  }, 180_000);

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    await fixture.cleanup();
    if (prevSkip === undefined) delete process.env.UMER_SECURITY_SKIP_AUDIT;
    else process.env.UMER_SECURITY_SKIP_AUDIT = prevSkip;
  });

  it('creates gate-security-* with humanRequired for dependency findings even when autoApplyEng=true', async () => {
    const intake = await request(server, 'POST', '/v1/intake', {
      projectId: 'demo-product',
      type: 'security',
      goal: 'Static security review before digital-product release',
      doneWhen: 'Elevated findings acknowledged',
    });
    expect(intake.status).toBe(201);

    const plan = intake.json.plan as {
      securityAudit?: {
        specialistId: string;
        forcesGate: boolean;
        findings: Array<{ category: string; severity: string; title: string }>;
        proposedDiff: string;
      };
      engDelivery?: unknown;
      category: string;
    };

    expect(plan.securityAudit?.specialistId).toBe('security.review');
    expect(plan.engDelivery).toBeUndefined();
    expect(plan.securityAudit?.proposedDiff).toBe('');
    expect(plan.category).toBe('digital-product');
    expect(plan.securityAudit?.findings.length).toBeGreaterThan(0);
    expect(
      plan.securityAudit?.findings.some(
        (f) => f.category === 'dependency' || f.severity === 'critical' || f.severity === 'high',
      ),
    ).toBe(true);

    const pending = await request(server, 'GET', '/v1/gates/pending');
    const secGate = (
      pending.json.gates as Array<{
        waitId: string;
        gateId: string;
        humanRequired: boolean;
      }>
    ).find((g) => g.gateId.startsWith('gate-security-'));

    expect(secGate).toBeTruthy();
    expect(secGate!.gateId).toBe('gate-security-demo-product');
    expect(secGate!.humanRequired).toBe(true);
    expect(
      (pending.json.gates as { gateId: string }[]).some((g) => g.gateId.startsWith('gate-eng-')),
    ).toBe(false);

    const { status, json } = await request(server, 'POST', `/v1/gates/${secGate!.waitId}/resolve`, {
      decision: 'Pass',
      approver: 'human.approver',
      rationale: 'Acknowledged security findings; remediations tracked separately',
    });
    expect(status).toBe(200);

    const applyResult = json.applyResult as {
      evidenceDir?: string;
      findingCount?: number;
      summary?: string;
    } | null;
    expect(applyResult?.evidenceDir).toMatch(/^\.umer\/security\/sec-demo-product-/);
    expect(applyResult?.findingCount).toBeGreaterThan(0);

    const runId = applyResult!.evidenceDir!.replace('.umer/security/', '');
    const findingsMd = await readFile(
      join(fixture.productDir, '.umer', 'security', runId, 'FINDINGS.md'),
      'utf8',
    );
    expect(findingsMd).toContain('security.review');
  });
});

describe('submitIntake security gate (state-level)', () => {
  let fixture: Awaited<ReturnType<typeof createSecurityFixture>>;
  const prevSkip = process.env.UMER_SECURITY_SKIP_AUDIT;

  beforeEach(async () => {
    delete process.env.UMER_SECURITY_SKIP_AUDIT;
    fixture = await createSecurityFixture();
  }, 180_000);

  afterEach(async () => {
    await fixture.cleanup();
    if (prevSkip === undefined) delete process.env.UMER_SECURITY_SKIP_AUDIT;
    else process.env.UMER_SECURITY_SKIP_AUDIT = prevSkip;
  });

  it('severity-first: elevated findings force humanRequired even on digital-product+autoApplyEng', async () => {
    const record = await submitIntake(fixture.state, {
      projectId: 'demo-product',
      type: 'security',
      goal: 'Confirm critical/high cannot be skipped by category',
    });

    expect(record.plan.securityAudit?.findings.length).toBeGreaterThan(0);
    const pending = await fixture.state.controlPlane.listPending();
    const gate = pending.find((g) => g.gateId === 'gate-security-demo-product');
    expect(gate).toBeTruthy();
    expect(gate!.humanRequired).toBe(true);
  });
});
