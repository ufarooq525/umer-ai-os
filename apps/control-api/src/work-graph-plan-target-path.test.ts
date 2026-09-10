import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { Server } from 'node:http';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createAuditService } from '@umer/audit';
import { createControlPlaneService, InMemorySpecialistControlStore } from '@umer/control-plane';
import { createProjectRegistry } from '@umer/registry';
import { createEventBus } from '@umer/event-bus';
import { createTrustRuntime } from '@umer/trust';
import { createCeoCommandService } from '@umer/control-plane';
import { InMemoryWorkGraphStore, PersistentWorkGraph } from '@umer/orchestration';
import type { CommandEnvelope } from '@umer/contracts';
import { createControlApiServer } from './server.js';
import { InMemoryProjectStore } from './project-store.js';
import { InMemoryTaskStore } from './task-store.js';
import { InMemoryAgentControlStore } from './agent-control-store.js';
import { registerQaBusShim, type ControlApiState } from './state.js';

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

// Deliberately builds its own catalog fixture (a real, on-disk registered
// codebase) rather than depending on the repo's real projects/catalog.json —
// whether any of those projects are actually checked out on disk varies by
// machine, so relying on one here would make this test non-deterministic.
async function createFixture(): Promise<{ state: ControlApiState; server: Server; cleanup: () => Promise<void> }> {
  const root = await mkdtemp(join(tmpdir(), 'umer-ctrl-plan-targetpath-'));
  const projectsRoot = join(root, 'www');
  const clientDir = join(projectsRoot, 'demo-client');
  const catalogPath = join(root, 'catalog.json');

  await mkdir(join(clientDir, 'src'), { recursive: true });
  await writeFile(join(clientDir, 'src', 'app.tsx'), 'export const App = () => null;\n', 'utf8');
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
            defaultSpecialists: ['ux.design'],
            constraints: [],
            tags: [],
          },
        ],
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  const trustRuntime = createTrustRuntime();
  await trustRuntime.registerGrant({
    grantId: 'grant-ceo-test',
    principalId: 'human.ceo',
    action: '*',
    resourceType: 'command',
    effect: 'allow',
  });
  const auditService = createAuditService();
  const projectStore = new InMemoryProjectStore();
  const taskStore = new InMemoryTaskStore();
  const agentControlStore = new InMemoryAgentControlStore();
  const workGraphStore = new InMemoryWorkGraphStore();

  const state: ControlApiState = {
    workPackages: [],
    intakes: [],
    auditService,
    projectRegistry: await createProjectRegistry({
      catalogPath,
      env: { UMER_PROJECTS_ROOT: projectsRoot },
    }),
    controlPlane: null as unknown as ControlApiState['controlPlane'],
    bus: createEventBus(),
    trustRuntime,
    projectStore,
    taskStore,
    agentControlStore,
    workGraphStore,
  };
  state.persistentWorkGraph = new PersistentWorkGraph(workGraphStore);
  state.controlPlane = createControlPlaneService({
    workPackagesAwaitingReview: () => state.workPackages.filter((wp) => wp.status === 'AwaitingReview').length,
  });
  state.commandService = createCeoCommandService(
    {
      opportunities: {
        getOpportunity: async () => undefined,
        saveOpportunity: async () => undefined,
      },
      projects: {
        get: (id) => projectStore.get(id),
        create: (input, correlationId) => projectStore.create(input, correlationId),
        list: (filter) => projectStore.list(filter),
        updateStatus: (id, status, correlationId) => projectStore.updateStatus(id, status, correlationId),
      },
      tasks: {
        get: (id) => taskStore.get(id),
        create: (input, correlationId) => taskStore.create(input, correlationId),
        assign: (taskId, agentId, correlationId) => taskStore.assign(taskId, agentId, correlationId),
        reassign: (taskId, agentId, correlationId) => taskStore.reassign(taskId, agentId, correlationId),
        updateStatus: (taskId, status, correlationId) => taskStore.updateStatus(taskId, status, correlationId),
      },
      agentControl: agentControlStore,
      specialistControl: new InMemorySpecialistControlStore(),
    },
    { trust: trustRuntime, auditService },
  );
  registerQaBusShim(state);

  const server = createControlApiServer(state);
  await new Promise<void>((resolve) => server.listen(0, resolve));

  return {
    state,
    server,
    cleanup: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
      await rm(root, { recursive: true, force: true });
    },
  };
}

describe('POST /v1/work-graph/:projectId/plan — real registered-project targetPath', () => {
  let fixture: Awaited<ReturnType<typeof createFixture>>;
  let publishCommand: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    fixture = await createFixture();
    publishCommand = vi.fn().mockResolvedValue(undefined);
    fixture.state.fabric = { publishCommand } as unknown as ControlApiState['fabric'];
  });

  afterEach(async () => {
    await fixture.cleanup();
  });

  it('resolves the real on-disk path and includes it as targetPath when the Work Graph project links to a registered codebase', async () => {
    const { state, server } = fixture;
    const project = await state.projectStore!.create(
      { name: 'Demo Client Work', registryProjectId: 'demo-client' },
      'corr-setup',
    );
    await request(server, 'POST', `/v1/work-graph/${project.projectId}/decompose`, {});

    const { status, json } = await request(server, 'POST', `/v1/work-graph/${project.projectId}/plan`, {
      approver: 'human.ceo',
    });

    expect(status).toBe(202);
    const expectedPath = state.projectRegistry.get('demo-client').absolutePath;
    expect(json.targetPath).toBe(expectedPath);

    const [, command] = publishCommand.mock.calls[0] as [string, CommandEnvelope];
    expect((command.payload as { targetPath?: string }).targetPath).toBe(expectedPath);
  });

  it('omits targetPath when the Work Graph project has no registryProjectId at all', async () => {
    const { state, server } = fixture;
    const project = await state.projectStore!.create({ name: 'Unlinked Project' }, 'corr-setup');
    await request(server, 'POST', `/v1/work-graph/${project.projectId}/decompose`, {});

    const { json } = await request(server, 'POST', `/v1/work-graph/${project.projectId}/plan`, {
      approver: 'human.ceo',
    });

    expect(json.targetPath).toBeNull();
    const [, command] = publishCommand.mock.calls[0] as [string, CommandEnvelope];
    expect((command.payload as { targetPath?: string }).targetPath).toBeUndefined();
  });

  it('omits targetPath (never guesses) when registryProjectId points at an unknown catalog entry', async () => {
    const { state, server } = fixture;
    const project = await state.projectStore!.create(
      { name: 'Stale Link Project', registryProjectId: 'does-not-exist-in-catalog' },
      'corr-setup',
    );
    await request(server, 'POST', `/v1/work-graph/${project.projectId}/decompose`, {});

    const { json } = await request(server, 'POST', `/v1/work-graph/${project.projectId}/plan`, {
      approver: 'human.ceo',
    });

    expect(json.targetPath).toBeNull();
  });
});
