import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import type { Server } from 'node:http';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createAuditService } from '@umer/audit';
import { createControlPlaneService } from '@umer/control-plane';
import { createProjectRegistry, contentHash, createManualCodeProducer } from '@umer/registry';
import { createEventBus } from '@umer/event-bus';
import { createControlApiServer } from './server.js';
import { registerQaBusShim, type ControlApiState } from './state.js';
import { splitUnifiedDiff, buildGateReview } from './gate-review.js';
import { parseContract, ArtifactContractSchema, SCHEMA_VERSION } from '@umer/contracts';
import {
  CODE_PRODUCER_ENV,
  listCodeProducers,
  resolveCodeProducer,
} from './code-producer.js';

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
  if (!address || typeof address === 'string') throw new Error('server not listening');
  const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, json: (await response.json()) as Record<string, unknown> };
}

async function createFixture(options: { withProducer?: boolean } = {}): Promise<{
  state: ControlApiState;
  clientDir: string;
  cleanup: () => Promise<void>;
}> {
  const root = await mkdtemp(join(tmpdir(), 'umer-ctrl-review-'));
  const projectsRoot = join(root, 'www');
  const clientDir = join(projectsRoot, 'demo-client');
  const catalogPath = join(root, 'catalog.json');

  await mkdir(join(clientDir, 'src'), { recursive: true });
  await writeFile(join(clientDir, SRC_REL), SRC_BEFORE, 'utf8');
  await writeFile(join(clientDir, 'phpunit.xml'), '<phpunit/>', 'utf8');

  await writeFile(
    catalogPath,
    `${JSON.stringify(
      {
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
            constraints: ['No schema changes'],
            tags: [],
          },
        ],
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  const state: ControlApiState = {
    workPackages: [],
    intakes: [],
    auditService: createAuditService(),
    projectRegistry: await createProjectRegistry({
      catalogPath,
      env: { UMER_PROJECTS_ROOT: projectsRoot },
    }),
    controlPlane: null as unknown as ControlApiState['controlPlane'],
    bus: createEventBus(),
    codeProducer: options.withProducer ? createManualCodeProducer() : undefined,
  };
  state.controlPlane = createControlPlaneService({
    workPackagesAwaitingReview: () =>
      state.workPackages.filter((wp) => wp.status === 'AwaitingReview').length,
  });
  registerQaBusShim(state);

  return {
    state,
    clientDir,
    cleanup: async () => {
      await rm(root, { recursive: true, force: true });
    },
  };
}

describe('splitUnifiedDiff', () => {
  it('splits a multi-file diff into per-file sections', () => {
    const diff = [
      'diff --git a/src/a.ts b/src/a.ts',
      '--- a/src/a.ts',
      '+++ b/src/a.ts',
      '@@ -1,1 +1,1 @@',
      '-old a',
      '+new a',
      'diff --git a/src/b.ts b/src/b.ts',
      '--- a/src/b.ts',
      '+++ b/src/b.ts',
      '@@ -1,1 +1,1 @@',
      '-old b',
      '+new b',
      '',
    ].join('\n');

    const byPath = splitUnifiedDiff(diff);
    expect([...byPath.keys()]).toEqual(['src/a.ts', 'src/b.ts']);
    expect(byPath.get('src/a.ts')).toContain('+new a');
    expect(byPath.get('src/a.ts')).not.toContain('new b');
  });

  it('returns nothing for empty or non-diff input', () => {
    expect(splitUnifiedDiff('').size).toBe(0);
    expect(splitUnifiedDiff('just a summary line').size).toBe(0);
  });
});

describe('buildGateReview', () => {
  it('returns null when no intake or work package backs the gate (demo seed)', () => {
    expect(
      buildGateReview({
        gate: { waitId: 'w1', gateId: 'gate-dev-qa', workPackageId: 'wp-e2e-1' },
        intakes: [],
      }),
    ).toBeNull();
  });

  it('builds a rich gate review for runtime work packages backed by a Code artifact', () => {
    const diff =
      'diff --git a/src/hello.ts b/src/hello.ts\n--- a/src/hello.ts\n+++ b/src/hello.ts\n@@ -1 +1 @@\n-export const greeting = "hello";\n+export const greeting = "hello world";\n';
    const review = buildGateReview({
      gate: { waitId: 'w-rt-1', gateId: 'gate-wp-pkg-100', workPackageId: 'pkg-100' },
      intakes: [],
      workPackages: [
        {
          workPackageId: 'pkg-100',
          execId: 'exec-100',
          status: 'AwaitingReview',
          specialistId: 'eng.app-delivery',
          stage: 'Implementation',
          projectId: 'demo-client',
          artifactId: 'art-100',
        },
      ],
      artifacts: [
        parseContract(ArtifactContractSchema, {
          id: 'art-100',
          schemaVersion: SCHEMA_VERSION,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          metadata: {
            labels: {},
            annotations: {
              proposedDiff: diff,
              filesChanged: '1',
              linesAdded: '1',
              linesRemoved: '1',
              testsRan: 'true',
              testsPassed: 'true',
              runId: 'eng-run-100',
            },
          },
          kind: 'artifact',
          artifactId: 'art-100',
          artifactType: 'Code',
          version: 'wp:pkg-100:1',
          producedBy: 'eng.app-delivery',
          producedFor: 'EXEC-100',
          acceptanceStatus: 'submitted',
          acceptanceCriteriaMet: [
            { criterion: 'Controlled repository diff', status: 'VERIFIED' },
            { criterion: 'Staged test execution', status: 'VERIFIED' },
          ],
          sourceTaskId: 'task-1',
          contentRef: 'file://eng-run-100/PROPOSED_DIFF.patch',
          contentHash: 'hash-100',
        }),
      ],
    });

    expect(review).toBeDefined();
    expect(review?.kind).toBe('code');
    expect(review?.code?.filesChanged).toBe(1);
    expect(review?.code?.testsRan).toBe(true);
    expect(review?.code?.testsPassed).toBe(true);
    expect(review?.code?.files[0]?.path).toBe('src/hello.ts');
    expect(review?.headline).toContain('demo-client');
    expect(review?.headline).toContain('staged tests passed');
  });

  it('builds a findings review for runtime QA Work Package backed by a TestPlanResults artifact', async () => {
    const fixture = await createFixture();
    const review = buildGateReview({
      gate: { waitId: 'wait-qa-1', gateId: 'gate-wp-pkg-qa-1', workPackageId: 'pkg-qa-1' },
      intakes: [],
      projectRegistry: fixture.state.projectRegistry,
      workPackages: [
        {
          workPackageId: 'pkg-qa-1',
          execId: 'EXEC-903',
          status: 'AwaitingReview',
          specialistId: 'qa.verify',
          stage: 'QA',
          projectId: 'demo-client',
          artifactId: 'art-qa-1',
        },
      ],
      artifacts: [
        parseContract(ArtifactContractSchema, {
          id: 'art-qa-1',
          schemaVersion: SCHEMA_VERSION,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          metadata: {
            labels: {},
            annotations: {
              suiteCommand: './vendor/bin/phpunit',
            },
          },
          kind: 'artifact',
          artifactId: 'art-qa-1',
          artifactType: 'TestPlanResults',
          version: 'wp:pkg-qa-1:1',
          producedBy: 'qa.verify',
          producedFor: 'EXEC-903',
          acceptanceStatus: 'submitted',
          acceptanceCriteriaMet: [
            { criterion: 'Unit test verification for multiply method', status: 'VERIFIED', evidenceRef: 'test://phpunit' },
            { criterion: 'Regression coverage verification', status: 'VERIFIED', evidenceRef: 'test://regression' },
          ],
          sourceTaskId: 'task-qa-1',
          contentRef: 'memory://artifacts/art-qa-1',
          contentHash: 'hash-qa-1',
        }),
      ],
    });

    expect(review).toBeDefined();
    expect(review?.kind).toBe('findings');
    expect(review?.requestedType).toBe('qa');
    expect(review?.findings?.counts.verified).toBe(2);
    expect(review?.findings?.counts.failed).toBe(0);
    expect(review?.findings?.items).toHaveLength(2);
    expect(review?.headline).toContain('QA Verification');
    expect(review?.headline).toContain('2 verified');
  });

  it('builds a findings review for runtime Security Work Package backed by a SecurityReport artifact', async () => {
    const fixture = await createFixture();
    const review = buildGateReview({
      gate: { waitId: 'wait-sec-1', gateId: 'gate-wp-pkg-sec-1', workPackageId: 'pkg-sec-1' },
      intakes: [],
      projectRegistry: fixture.state.projectRegistry,
      workPackages: [
        {
          workPackageId: 'pkg-sec-1',
          execId: 'EXEC-904',
          status: 'AwaitingReview',
          specialistId: 'security.review',
          stage: 'Security',
          projectId: 'demo-client',
          artifactId: 'art-sec-1',
        },
      ],
      artifacts: [
        parseContract(ArtifactContractSchema, {
          id: 'art-sec-1',
          schemaVersion: SCHEMA_VERSION,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          metadata: {
            labels: {},
            annotations: {
              scanCommand: 'npm audit',
            },
          },
          kind: 'artifact',
          artifactId: 'art-sec-1',
          artifactType: 'SecurityReport',
          version: 'wp:pkg-sec-1:1',
          producedBy: 'security.review',
          producedFor: 'EXEC-904',
          acceptanceStatus: 'submitted',
          acceptanceCriteriaMet: [
            { criterion: 'Dependency vulnerability audit', status: 'VERIFIED', evidenceRef: 'sec://npm-audit' },
            { criterion: 'Static code secret scan', status: 'VERIFIED', evidenceRef: 'sec://secret-scan' },
          ],
          sourceTaskId: 'task-sec-1',
          contentRef: 'memory://artifacts/art-sec-1',
          contentHash: 'hash-sec-1',
        }),
      ],
    });

    expect(review).toBeDefined();
    expect(review?.kind).toBe('findings');
    expect(review?.requestedType).toBe('security');
    expect(review?.findings?.counts.verified).toBe(2);
    expect(review?.findings?.counts.failed).toBe(0);
    expect(review?.findings?.items).toHaveLength(2);
    expect(review?.headline).toContain('Security Review');
    expect(review?.headline).toContain('2 verified');
  });
});

describe('gate review route', () => {
  let fixture: Awaited<ReturnType<typeof createFixture>>;
  let server: ReturnType<typeof createControlApiServer>;
  const prevSkipRun = process.env.UMER_QA_SKIP_RUN;

  beforeEach(async () => {
    process.env.UMER_QA_SKIP_RUN = '1';
    fixture = await createFixture();
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
  });

  it('describes a code gate: per-file diff, author, and what Pass will do', async () => {
    await request(server, 'POST', '/v1/intake', {
      projectId: 'demo-client',
      type: 'feature',
      goal: 'Update the greeting string for client delivery',
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

    const pending = await request(server, 'GET', '/v1/gates/pending');
    const gate = (pending.json.gates as Array<{ waitId: string; gateId: string }>).find((g) =>
      g.gateId.startsWith('gate-eng-'),
    )!;

    const { status, json } = await request(server, 'GET', `/v1/gates/${gate.waitId}/review`);
    expect(status).toBe(200);

    const review = json.review as {
      kind: string;
      headline: string;
      onApprove: string;
      code?: {
        files: Array<{ path: string; action: string; diff: string; linesAdded: number }>;
        filesChanged: number;
        author: string;
        status: string;
        blockers: string[];
      };
      findings?: unknown;
    };

    expect(review.kind).toBe('code');
    expect(review.code?.status).toBe('ready');
    expect(review.code?.filesChanged).toBe(1);
    expect(review.code?.files[0]?.path).toBe(SRC_REL);
    expect(review.code?.files[0]?.action).toBe('modify');
    expect(review.code?.files[0]?.diff).toContain('hello world');
    expect(review.code?.files[0]?.linesAdded).toBe(1);
    expect(review.code?.author).toBe('intake change-set');
    expect(review.onApprove).toContain('.umer/eng/');
    expect(review.onApprove).toContain('Nothing is pushed to git');
    expect(review.findings).toBeUndefined();
  });

  it('describes a findings gate as report-only', async () => {
    await request(server, 'POST', '/v1/intake', {
      projectId: 'demo-client',
      type: 'ux',
      goal: 'The dashboard ui feels dated — audit layout and spacing',
    });

    const pending = await request(server, 'GET', '/v1/gates/pending');
    const gate = (pending.json.gates as Array<{ waitId: string; gateId: string }>).find((g) =>
      g.gateId.startsWith('gate-ux-'),
    )!;

    const { json } = await request(server, 'GET', `/v1/gates/${gate.waitId}/review`);
    const review = json.review as {
      kind: string;
      headline: string;
      onApprove: string;
      findings?: { items: unknown[] };
      routing?: { suggestedType: string; agreed: boolean };
      code?: unknown;
    };

    expect(review.kind).toBe('findings');
    expect(review.code).toBeUndefined();
    expect(review.findings?.items.length).toBeGreaterThan(0);
    expect(review.headline).toContain('report only');
    expect(review.onApprove).toContain('follow-up feature or bug task');
    expect(review.routing?.suggestedType).toBe('ux');
    expect(review.routing?.agreed).toBe(true);
  });

  it('flags a mismatch when the operator picked a different desk than PM would', async () => {
    await request(server, 'POST', '/v1/intake', {
      projectId: 'demo-client',
      type: 'feature',
      goal: 'The ui looks weird and traditional, redesign the layout please',
    });

    const pending = await request(server, 'GET', '/v1/gates/pending');
    const gate = (pending.json.gates as Array<{ waitId: string; gateId: string }>)[0]!;
    const { json } = await request(server, 'GET', `/v1/gates/${gate.waitId}/review`);
    const review = json.review as { routing?: { agreed: boolean; note: string } };

    expect(review.routing?.agreed).toBe(false);
    expect(review.routing?.note).toContain('reads like ux');
  });

  it('404s for an unknown gate', async () => {
    const { status, json } = await request(server, 'GET', '/v1/gates/does-not-exist/review');
    expect(status).toBe(404);
    expect(json.error).toBe('gate_not_pending');
  });
});

describe('intake routing route', () => {
  let fixture: Awaited<ReturnType<typeof createFixture>>;
  let server: ReturnType<typeof createControlApiServer>;

  beforeEach(async () => {
    fixture = await createFixture({ withProducer: true });
    server = createControlApiServer(fixture.state);
    await new Promise<void>((resolve) => server.listen(0, resolve));
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    await fixture.cleanup();
  });

  it('suggests a desk for plain-language goals', async () => {
    const { status, json } = await request(server, 'POST', '/v1/intake/route', {
      goal: 'the portal ui is so weird and traditional, please modernise the layout',
    });
    expect(status).toBe(200);

    const routing = json.routing as {
      suggestedType: string;
      writesCode: boolean;
      reason: string;
      followUp?: string;
    };
    expect(routing.suggestedType).toBe('ux');
    expect(routing.writesCode).toBe(false);
    expect(routing.followUp).toContain('feature or bug');
    expect(json.activeCodeProducer).toBe('manual.human-change-set');
  });

  it('rejects a goal that is too short to route', async () => {
    const { status, json } = await request(server, 'POST', '/v1/intake/route', { goal: 'fix' });
    expect(status).toBe(400);
    expect(json.error).toContain('at least 8 characters');
  });

  it('reports the eng producer decline as a blocker instead of inventing code', async () => {
    process.env.UMER_QA_SKIP_RUN = '1';
    const intake = await request(server, 'POST', '/v1/intake', {
      projectId: 'demo-client',
      type: 'feature',
      goal: 'Add a greeting toggle to the hello module',
      targetFiles: [SRC_REL],
    });
    expect(intake.status).toBe(201);

    const plan = intake.json.plan as {
      engDelivery?: {
        status: string;
        blockers: string[];
        production?: { producerId: string; status: string; draft: Array<{ path: string }> };
      };
    };
    expect(plan.engDelivery?.status).toBe('needs-manual-scoping');
    expect(plan.engDelivery?.production?.producerId).toBe('manual.human-change-set');
    expect(plan.engDelivery?.production?.status).toBe('declined');
    expect(plan.engDelivery?.production?.draft[0]?.path).toBe(SRC_REL);
    expect(plan.engDelivery?.blockers.join(' ')).toContain('declined');
    delete process.env.UMER_QA_SKIP_RUN;
  });
});

describe('resolveCodeProducer', () => {
  it('defaults to the manual producer', () => {
    const resolution = resolveCodeProducer({});
    expect(resolution.producer.id).toBe('manual.human-change-set');
    expect(resolution.fallbackReason).toBeUndefined();
  });

  it('honours an explicit known producer', () => {
    const resolution = resolveCodeProducer({ [CODE_PRODUCER_ENV]: 'manual' });
    expect(resolution.producer.id).toBe('manual.human-change-set');
    expect(resolution.requested).toBe('manual');
  });

  it('fails closed to manual for an unknown producer', () => {
    const resolution = resolveCodeProducer({ [CODE_PRODUCER_ENV]: 'some-llm' });
    expect(resolution.producer.id).toBe('manual.human-change-set');
    expect(resolution.fallbackReason).toContain('Unknown');
    expect(listCodeProducers()).toContain('manual');
  });
});
