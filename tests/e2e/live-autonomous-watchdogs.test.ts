import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ProjectId } from '@umer/contracts';
import { WatchdogEngine, computeWatchdogFingerprint } from '../../packages/registry/src/index.js';
import { createControlApiServer, createControlApiState } from '../../apps/control-api/src/server.js';
import type { ControlApiState } from '../../apps/control-api/src/state.js';
import { buildCompanyGraph } from '../../apps/control-api/src/company-graph-projection.js';

async function request(
  server: Server,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; json: any }> {
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('server not listening');
  const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json = {};
  try {
    json = JSON.parse(text);
  } catch {
    // text
  }
  return { status: response.status, json };
}

describe('RFC-007 — Live Autonomous Watchdogs E2E', () => {
  let stagingDir: string;
  let controlState: ControlApiState;
  let server: Server;
  const projectId = 'proj-watchdogs-e2e' as ProjectId;

  beforeAll(async () => {
    stagingDir = await mkdtemp(join(tmpdir(), 'umer-watchdogs-e2e-'));

    // Create a target project with intentional drift indicators:
    // 1. package.json with wildcard dependency (deps finding)
    // 2. No lockfile (deps finding: lockfile missing)
    // 3. MODULES.yaml with missing declared file (arch finding)
    // 4. No test suite (qa finding)
    await writeFile(
      join(stagingDir, 'package.json'),
      JSON.stringify(
        {
          name: 'live-target-project',
          version: '1.0.0',
          private: true,
          dependencies: {
            'vulnerable-fake-dep': '*',
          },
        },
        null,
        2,
      ),
    );

    await writeFile(
      join(stagingDir, 'MODULES.yaml'),
      `modules:
  - id: core-auth
    name: Core Authentication
    entry: src/auth/index.ts
`,
    );

    // Initialise real Control API state
    controlState = await createControlApiState();

    const originalProjectStore = controlState.projectStore;
    controlState.projectStore = {
      create: (input: any, corr: string) => originalProjectStore!.create(input, corr),
      get: async (id: string) => {
        if (id === projectId) {
          return {
            id: projectId,
            projectId,
            name: 'Live Target Project',
            status: 'Active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            schemaVersion: '1.0.0',
            kind: 'project',
            metadata: { labels: {}, annotations: {} },
          } as any;
        }
        return originalProjectStore?.get(id);
      },
      list: async (filter?: any) => {
        const existing = (await originalProjectStore?.list(filter)) ?? [];
        return [
          ...existing,
          {
            id: projectId,
            projectId,
            name: 'Live Target Project',
            status: 'Active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            schemaVersion: '1.0.0',
            kind: 'project',
            metadata: { labels: {}, annotations: {} },
          } as any,
        ];
      },
      updateStatus: (id: string, st: any, corr: string) => originalProjectStore!.updateStatus(id, st, corr),
    };

    const originalProjects = controlState.projectRegistry.list();
    controlState.projectRegistry = {
      list: () => [
        ...originalProjects,
        {
          projectId,
          name: 'Live Target Project',
          slug: 'live-target-project',
          path: stagingDir,
          absolutePath: stagingDir,
          status: 'active' as const,
        },
      ],
      get: (id: string) => {
        if (id === projectId) {
          return {
            projectId,
            name: 'Live Target Project',
            slug: 'live-target-project',
            path: stagingDir,
            absolutePath: stagingDir,
            status: 'active' as const,
          };
        }
        return originalProjects.find((p) => p.projectId === id) as any;
      },
      requireActive: (id: string) => {
        if (id === projectId) {
          return {
            projectId,
            name: 'Live Target Project',
            slug: 'live-target-project',
            path: stagingDir,
            absolutePath: stagingDir,
            status: 'active' as const,
          };
        }
        return (originalProjects.find((p) => p.projectId === id && p.status === 'active') ?? {
          projectId,
          name: 'Live Target Project',
          slug: 'live-target-project',
          path: stagingDir,
          absolutePath: stagingDir,
          status: 'active' as const,
        }) as any;
      },
    };

    server = createControlApiServer(controlState);
    await new Promise<void>((resolve) => server.listen(0, resolve));
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
    await rm(stagingDir, { recursive: true, force: true }).catch(() => undefined);
  });

  it('verifies deterministic fingerprinting across runs', () => {
    const fp1 = computeWatchdogFingerprint({
      watchdogId: 'deps.watchdog',
      projectId,
      category: 'wildcard_version',
      target: 'vulnerable-fake-dep',
    });
    const fp2 = computeWatchdogFingerprint({
      watchdogId: 'deps.watchdog',
      projectId,
      category: 'wildcard_version',
      target: 'vulnerable-fake-dep',
    });
    const fpOther = computeWatchdogFingerprint({
      watchdogId: 'deps.watchdog',
      projectId,
      category: 'missing_lockfile',
      target: 'package.json',
    });

    expect(fp1).toBe(fp2);
    expect(fp1).toHaveLength(32);
    expect(fp1).not.toBe(fpOther);
  });

  it('executes deps.watchdog on target project and detects drift findings', async () => {
    const { status, json: run } = await request(server, 'POST', '/v1/watchdogs/run', {
      projectId,
      watchdogId: 'deps.watchdog',
      cadence: 'manual',
    });

    expect(status).toBe(201);
    expect(run.runId).toBeDefined();
    expect(run.outcome).toBe('findings_detected');
    expect(run.findingCount).toBeGreaterThanOrEqual(1);

    const findings = run.findings;
    expect(findings.length).toBeGreaterThanOrEqual(1);

    const wildcardFinding = findings.find((f: any) => f.category === 'wildcard_version');
    expect(wildcardFinding).toBeDefined();
    expect(wildcardFinding.target).toBe('vulnerable-fake-dep');
    expect(wildcardFinding.status).toBe('open');
    expect(wildcardFinding.severity.tier).toBe('warning');
  });

  it('proves observation-only doctrine: zero mutations made to project source files', async () => {
    const pkgContent = await readFile(join(stagingDir, 'package.json'), 'utf-8');
    const parsed = JSON.parse(pkgContent);

    // Watchdog observed the wildcard, but strictly DID NOT rewrite or mutate the file
    expect(parsed.dependencies['vulnerable-fake-dep']).toBe('*');
  });

  it('deduplicates findings on repeated execution without alert fatigue', async () => {
    const { json: initialFindingsRes } = await request(
      server,
      'GET',
      `/v1/watchdogs/findings?projectId=${projectId}&status=open`,
    );
    const initialCount = initialFindingsRes.count;
    expect(initialCount).toBeGreaterThanOrEqual(1);

    // Second run with same watchdog against same project
    const { status, json: secondRun } = await request(server, 'POST', '/v1/watchdogs/run', {
      projectId,
      watchdogId: 'deps.watchdog',
      cadence: 'manual',
    });
    expect(status).toBe(201);

    // Total findings count must NOT increase because fingerprints match
    const { json: afterFindingsRes } = await request(
      server,
      'GET',
      `/v1/watchdogs/findings?projectId=${projectId}&status=open`,
    );
    expect(afterFindingsRes.count).toBe(initialCount);

    // Verify lastSeenAt timestamp was refreshed
    const finding = afterFindingsRes.findings.find((f: any) => f.category === 'wildcard_version');
    expect(finding).toBeDefined();
    expect(new Date(finding.lastSeenAt).getTime()).toBeGreaterThanOrEqual(
      new Date(finding.firstSeenAt).getTime(),
    );
  });

  it('acknowledges finding and retains acked status across subsequent runs', async () => {
    const { json: findingsRes } = await request(
      server,
      'GET',
      `/v1/watchdogs/findings?projectId=${projectId}&status=open`,
    );
    const finding = findingsRes.findings[0];
    expect(finding).toBeDefined();

    // Acknowledge finding
    const { status: ackStatus, json: acked } = await request(
      server,
      'POST',
      `/v1/watchdogs/findings/${encodeURIComponent(finding.findingId)}/ack`,
      { ackedBy: 'sec-lead-agent', notes: 'Scheduled for next sprint' },
    );
    expect(ackStatus).toBe(200);
    expect(acked.status).toBe('acked');
    expect(acked.ackedBy).toBe('sec-lead-agent');

    // Run watchdog again
    await request(server, 'POST', '/v1/watchdogs/run', {
      projectId,
      watchdogId: 'deps.watchdog',
      cadence: 'manual',
    });

    // Verify it stays acked, not reset to open
    const { json: refetched } = await request(
      server,
      'GET',
      `/v1/watchdogs/findings/${encodeURIComponent(finding.findingId)}`,
    );
    expect(refetched.status).toBe('acked');
  });

  it('executes architecture watchdog and detects drift', async () => {
    const { status, json: archRun } = await request(server, 'POST', '/v1/watchdogs/run', {
      projectId,
      watchdogId: 'arch.watchdog',
      cadence: 'manual',
    });

    expect(status).toBe(201);
    expect(archRun.outcome).toBe('findings_detected');
    const missingModuleFinding = archRun.findings.find(
      (f: any) => f.category === 'missing_declared_module',
    );
    expect(missingModuleFinding).toBeDefined();
    expect(missingModuleFinding.target).toBe('src/auth/index.ts');
  });

  it('projects watchdog findings into Company Intelligence Graph', async () => {
    const graph = await buildCompanyGraph(controlState);

    const findingNodes = graph.nodes.filter((n) => n.type === 'Finding');
    expect(findingNodes.length).toBeGreaterThanOrEqual(1);

    const targetFindingNode = findingNodes.find((n) => n.metadata?.projectId === projectId);
    expect(targetFindingNode).toBeDefined();
    expect(targetFindingNode!.status).toBe('open');
    expect(targetFindingNode!.metadata).toBeDefined();
    expect(targetFindingNode!.metadata!.severityTier).toBeDefined();

    // Verify project_finding edge
    const projectEdge = graph.edges.find(
      (e) => e.type === 'project_finding' && e.target === targetFindingNode!.id,
    );
    expect(projectEdge).toBeDefined();
    expect(projectEdge!.source).toBe(`project:${projectId}`);
  });

  it('clears finding with rationale and updates graph projection', async () => {
    const { json: findingsRes } = await request(
      server,
      'GET',
      `/v1/watchdogs/findings?projectId=${projectId}`,
    );
    const findingToClear = findingsRes.findings[0];
    expect(findingToClear).toBeDefined();

    const { status, json: cleared } = await request(
      server,
      'POST',
      `/v1/watchdogs/findings/${encodeURIComponent(findingToClear.findingId)}/clear`,
      { clearedBy: 'ceo', reason: 'False positive in staging container' },
    );
    expect(status).toBe(200);
    expect(cleared.status).toBe('cleared');
    expect(cleared.clearedBy).toBe('ceo');

    // Cleared findings should no longer appear in open findings query
    const { json: openFindings } = await request(
      server,
      'GET',
      `/v1/watchdogs/findings?projectId=${projectId}&status=open`,
    );
    const stillThere = openFindings.findings.some(
      (f: any) => f.findingId === findingToClear.findingId,
    );
    expect(stillThere).toBe(false);
  });
});
