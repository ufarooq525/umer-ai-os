import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { Server } from 'node:http';
import type { CommandEnvelope } from '@umer/contracts';
import { SUBJECTS } from '@umer/message-fabric';
import { ORCHESTRATION_COMMANDS } from '@umer/orchestration';
import { createControlApiServer, createControlApiState } from './server.js';
import { InMemoryRequirementStore } from './requirement-store.js';
import { connectRequirementWorkGraphBridge } from './requirement-workgraph-bridge.js';
import type { ControlApiState } from './state.js';

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

describe('POST /v1/work-graph/:projectId/plan', () => {
  let state: ControlApiState;
  let server: Server;
  let publishCommand: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    state = await createControlApiState();
    publishCommand = vi.fn().mockResolvedValue(undefined);
    state.fabric = { publishCommand } as unknown as ControlApiState['fabric'];
    server = createControlApiServer(state);
    await new Promise<void>((resolve) => server.listen(0, resolve));
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('requires an approver', async () => {
    const { status, json } = await request(server, 'POST', '/v1/work-graph/proj-1/plan', {});
    expect(status).toBe(400);
    expect(json.error).toContain('approver');
    expect(publishCommand).not.toHaveBeenCalled();
  });

  it('reports no ready nodes for a project with no Work Graph, without creating any Task or publishing a command', async () => {
    const { status, json } = await request(server, 'POST', '/v1/work-graph/proj-1/plan', {
      approver: 'human.ceo',
    });
    expect(status).toBe(200);
    expect(json.readyNodeIds).toEqual([]);
    expect(publishCommand).not.toHaveBeenCalled();
  });

  it('creates a real Task per ready node and publishes workgraph.plan with the real task ids', async () => {
    await request(server, 'POST', '/v1/work-graph/proj-1/decompose', {});

    const { status, json } = await request(server, 'POST', '/v1/work-graph/proj-1/plan', {
      approver: 'human.ceo',
    });

    expect(status).toBe(202);
    // Only 'Requirements' has no predecessor, so it's the only Ready node right after decomposition.
    expect(json.readyNodeIds).toEqual(['proj-1-requirements']);
    const taskIdsByNodeId = json.taskIdsByNodeId as Record<string, string[]>;
    const taskId = taskIdsByNodeId['proj-1-requirements']![0]!;
    expect(taskId).toBeDefined();

    const task = await state.taskStore!.get(taskId);
    expect(task).toMatchObject({ projectId: 'proj-1', title: 'Requirements' });

    expect(publishCommand).toHaveBeenCalledTimes(1);
    const [subject, command] = publishCommand.mock.calls[0] as [string, CommandEnvelope];
    expect(subject).toBe(SUBJECTS.CMD_ORCHESTRATION);
    expect(command.name).toBe(ORCHESTRATION_COMMANDS.PLAN_PROJECT);
    expect(command.payload).toMatchObject({
      projectId: 'proj-1',
      taskIdsByNodeId: { 'proj-1-requirements': [taskId] },
    });
  });

  it('grounds the Requirements node Task in the real persisted Requirement content', async () => {
    state.requirementStore = new InMemoryRequirementStore();
    connectRequirementWorkGraphBridge(state);
    const requirement = await state.requirementStore.create({
      projectId: 'proj-grounded',
      title: 'Add checkout retries',
      problem: 'Checkout fails silently on transient gateway errors.',
      desiredOutcome: 'Checkout succeeds after a transient gateway failure without manual retry.',
      constraints: ['Must not change the public checkout API'],
      acceptanceCriteria: ['Checkout retries once on a transient gateway error.'],
      source: { kind: 'Request', label: 'test' },
    });

    const { status, json } = await request(server, 'POST', '/v1/work-graph/proj-grounded/plan', {
      approver: 'human.ceo',
    });
    expect(status).toBe(202);

    const taskIdsByNodeId = json.taskIdsByNodeId as Record<string, string[]>;
    const [nodeId] = Object.keys(taskIdsByNodeId);
    const taskId = taskIdsByNodeId[nodeId!]![0]!;
    const task = await state.taskStore!.get(taskId);

    expect(task?.description).toContain(requirement.problem);
    expect(task?.description).toContain(requirement.desiredOutcome);
    expect(task?.description).toContain('Must not change the public checkout API');
    expect(task?.acceptanceCriteria).toEqual(requirement.acceptanceCriteria);
  });

  it('falls back to the generic Task description for a Requirements node with no linked Requirement', async () => {
    await request(server, 'POST', '/v1/work-graph/proj-ungrounded/decompose', {});

    const { json } = await request(server, 'POST', '/v1/work-graph/proj-ungrounded/plan', {
      approver: 'human.ceo',
    });

    const taskIdsByNodeId = json.taskIdsByNodeId as Record<string, string[]>;
    const taskId = taskIdsByNodeId['proj-ungrounded-requirements']![0]!;
    const task = await state.taskStore!.get(taskId);
    expect(task?.description).toBe('Deliver "Requirements" for project proj-ungrounded, per its Work Graph decomposition.');
  });

  it('grounds the Architecture node Task in Requirement and Product context when Architecture is Ready', async () => {
    state.requirementStore = new InMemoryRequirementStore();
    connectRequirementWorkGraphBridge(state);
    const requirement = await state.requirementStore.create({
      projectId: 'proj-arch-grounded',
      title: 'Add checkout retries',
      problem: 'Checkout fails silently on transient gateway errors.',
      desiredOutcome: 'Checkout succeeds after a transient gateway failure without manual retry.',
      constraints: ['Must not change the public checkout API'],
      acceptanceCriteria: ['Checkout retries once on a transient gateway error.'],
      source: { kind: 'Request', label: 'test' },
    });

    // Advance Requirements and Product nodes to Accepted so Architecture becomes Ready
    const graph = await state.persistentWorkGraph!.load('proj-arch-grounded');
    const requirementsNode = graph.listNodes('proj-arch-grounded').find((n) => n.type === 'Requirements')!;
    const productNode = graph.listNodes('proj-arch-grounded').find((n) => n.type === 'Product')!;
    const archNode = graph.listNodes('proj-arch-grounded').find((n) => n.type === 'Architecture')!;

    for (const nodeId of [requirementsNode.nodeId, productNode.nodeId]) {
      await state.persistentWorkGraph!.setNodeStatus(graph, 'proj-arch-grounded', nodeId, 'InProgress');
      await state.persistentWorkGraph!.setNodeStatus(graph, 'proj-arch-grounded', nodeId, 'Review');
      await state.persistentWorkGraph!.setNodeStatus(graph, 'proj-arch-grounded', nodeId, 'Accepted');
    }

    // Seed prior product task to verify product context inclusion
    await state.taskStore!.create(
      {
        epicId: 'epic-proj-arch-grounded',
        projectId: 'proj-arch-grounded',
        title: 'Product Definition',
        description: 'Product scope: automatic retry for transient payment gateway errors.',
        acceptanceCriteria: ['Product scope defined'],
      },
      'corr-test',
    );

    const { status, json } = await request(server, 'POST', '/v1/work-graph/proj-arch-grounded/plan', {
      approver: 'human.ceo',
    });
    expect(status).toBe(202);

    const taskIdsByNodeId = json.taskIdsByNodeId as Record<string, string[]>;
    expect(taskIdsByNodeId[archNode.nodeId]).toBeDefined();
    const taskId = taskIdsByNodeId[archNode.nodeId]![0]!;
    const task = await state.taskStore!.get(taskId);

    expect(task?.description).toContain('Define system architecture, data model');
    expect(task?.description).toContain(requirement.problem);
    expect(task?.description).toContain(requirement.desiredOutcome);
    expect(task?.description).toContain('Product context: Product scope: automatic retry');
    expect(task?.acceptanceCriteria).toContain('Checkout retries once on a transient gateway error.');
    expect(task?.acceptanceCriteria).toContain(
      'System architecture, data model, API contracts, security architecture, and deployment topology documented and reviewed',
    );
  });

  it('grounds the UX node Task in Requirement and Product context when UX is Ready', async () => {
    state.requirementStore = new InMemoryRequirementStore();
    connectRequirementWorkGraphBridge(state);
    const requirement = await state.requirementStore.create({
      projectId: 'proj-ux-grounded',
      title: 'Add checkout retries',
      problem: 'Checkout fails silently on transient gateway errors.',
      desiredOutcome: 'Checkout succeeds after a transient gateway failure without manual retry.',
      constraints: ['Must not change the public checkout API'],
      acceptanceCriteria: ['Checkout retries once on a transient gateway error.'],
      source: { kind: 'Request', label: 'test' },
    });

    // Advance Requirements and Product nodes to Accepted so UX (and Architecture) become Ready
    const graph = await state.persistentWorkGraph!.load('proj-ux-grounded');
    const requirementsNode = graph.listNodes('proj-ux-grounded').find((n) => n.type === 'Requirements')!;
    const productNode = graph.listNodes('proj-ux-grounded').find((n) => n.type === 'Product')!;
    const uxNode = graph.listNodes('proj-ux-grounded').find((n) => n.type === 'UX')!;

    for (const nodeId of [requirementsNode.nodeId, productNode.nodeId]) {
      await state.persistentWorkGraph!.setNodeStatus(graph, 'proj-ux-grounded', nodeId, 'InProgress');
      await state.persistentWorkGraph!.setNodeStatus(graph, 'proj-ux-grounded', nodeId, 'Review');
      await state.persistentWorkGraph!.setNodeStatus(graph, 'proj-ux-grounded', nodeId, 'Accepted');
    }

    // Seed prior product task to verify product context inclusion
    await state.taskStore!.create(
      {
        epicId: 'epic-proj-ux-grounded',
        projectId: 'proj-ux-grounded',
        title: 'Product Definition',
        description: 'Product scope: automatic retry for transient payment gateway errors.',
        acceptanceCriteria: ['Product scope defined'],
      },
      'corr-test',
    );

    const { status, json } = await request(server, 'POST', '/v1/work-graph/proj-ux-grounded/plan', {
      approver: 'human.ceo',
    });
    expect(status).toBe(202);

    const taskIdsByNodeId = json.taskIdsByNodeId as Record<string, string[]>;
    expect(taskIdsByNodeId[uxNode.nodeId]).toBeDefined();
    const taskId = taskIdsByNodeId[uxNode.nodeId]![0]!;
    const task = await state.taskStore!.get(taskId);

    expect(task?.description).toContain('Design user experience, user flows');
    expect(task?.description).toContain(requirement.problem);
    expect(task?.description).toContain(requirement.desiredOutcome);
    expect(task?.description).toContain('Product context: Product scope: automatic retry');
    expect(task?.acceptanceCriteria).toContain('Checkout retries once on a transient gateway error.');
    expect(task?.acceptanceCriteria).toContain(
      'User experience, user flows, interaction patterns, accessibility standards, and UI layout specifications documented and reviewed',
    );
  });

  it('grounds the Implementation node Task in Requirement, Architecture, and UX context when Implementation is Ready', async () => {
    state.requirementStore = new InMemoryRequirementStore();
    connectRequirementWorkGraphBridge(state);
    const requirement = await state.requirementStore.create({
      projectId: 'proj-impl-grounded',
      title: 'Add checkout retries',
      problem: 'Checkout fails silently on transient gateway errors.',
      desiredOutcome: 'Checkout succeeds after a transient gateway failure without manual retry.',
      constraints: ['Must not change the public checkout API'],
      acceptanceCriteria: ['Checkout retries once on a transient gateway error.'],
      source: { kind: 'Request', label: 'test' },
    });

    // Advance Requirements, Product, Architecture, and UX nodes to Accepted so Implementation becomes Ready
    const graph = await state.persistentWorkGraph!.load('proj-impl-grounded');
    const requirementsNode = graph.listNodes('proj-impl-grounded').find((n) => n.type === 'Requirements')!;
    const productNode = graph.listNodes('proj-impl-grounded').find((n) => n.type === 'Product')!;
    const archNode = graph.listNodes('proj-impl-grounded').find((n) => n.type === 'Architecture')!;
    const uxNode = graph.listNodes('proj-impl-grounded').find((n) => n.type === 'UX')!;
    const implNode = graph.listNodes('proj-impl-grounded').find((n) => n.type === 'Implementation')!;

    for (const nodeId of [requirementsNode.nodeId, productNode.nodeId, archNode.nodeId, uxNode.nodeId]) {
      await state.persistentWorkGraph!.setNodeStatus(graph, 'proj-impl-grounded', nodeId, 'InProgress');
      await state.persistentWorkGraph!.setNodeStatus(graph, 'proj-impl-grounded', nodeId, 'Review');
      await state.persistentWorkGraph!.setNodeStatus(graph, 'proj-impl-grounded', nodeId, 'Accepted');
    }

    // Seed prior architecture and UX tasks to verify upstream context inclusion
    await state.taskStore!.create(
      {
        epicId: 'epic-proj-impl-grounded',
        projectId: 'proj-impl-grounded',
        title: 'Architecture Design',
        description: 'Architecture specs: PaymentGatewayClient with exponential backoff.',
        acceptanceCriteria: ['Architecture documented'],
      },
      'corr-test',
    );
    await state.taskStore!.create(
      {
        epicId: 'epic-proj-impl-grounded',
        projectId: 'proj-impl-grounded',
        title: 'UX Design',
        description: 'UX specs: Retry button with loading spinner.',
        acceptanceCriteria: ['UX documented'],
      },
      'corr-test',
    );

    const { status, json } = await request(server, 'POST', '/v1/work-graph/proj-impl-grounded/plan', {
      approver: 'human.ceo',
    });
    expect(status).toBe(202);

    const taskIdsByNodeId = json.taskIdsByNodeId as Record<string, string[]>;
    expect(taskIdsByNodeId[implNode.nodeId]).toBeDefined();
    const taskId = taskIdsByNodeId[implNode.nodeId]![0]!;
    const task = await state.taskStore!.get(taskId);

    expect(task?.description).toContain('Implement software changes for this Requirement');
    expect(task?.description).toContain(requirement.problem);
    expect(task?.description).toContain(requirement.desiredOutcome);
    expect(task?.description).toContain('Architecture context: Architecture specs: PaymentGatewayClient');
    expect(task?.description).toContain('UX context: UX specs: Retry button');
    expect(task?.acceptanceCriteria).toContain('Checkout retries once on a transient gateway error.');
    expect(task?.acceptanceCriteria).toContain(
      'Scoped repository change implemented with unified diff and passing test evidence',
    );
    expect(task?.acceptanceCriteria).toContain('Implementation artifact submitted for human review gate');
  });

  it('grounds QA and Security node Tasks in Requirement and Implementation context when Ready', async () => {
    state.requirementStore = new InMemoryRequirementStore();
    connectRequirementWorkGraphBridge(state);
    const requirement = await state.requirementStore.create({
      projectId: 'proj-qa-sec-grounded',
      title: 'Harden API authentication',
      problem: 'Legacy API endpoints allow unauthenticated access.',
      desiredOutcome: 'All API routes require valid JWT tokens.',
      constraints: ['Zero backward-incompatible breaks for v1 clients'],
      acceptanceCriteria: ['All endpoints reject unauthenticated requests with 401.'],
      source: { kind: 'Request', label: 'security-audit' },
    });

    // Advance nodes up to Implementation Accepted so QA and Security become Ready
    const graph = await state.persistentWorkGraph!.load('proj-qa-sec-grounded');
    const nodes = graph.listNodes('proj-qa-sec-grounded');
    const reqNode = nodes.find((n) => n.type === 'Requirements')!;
    const prodNode = nodes.find((n) => n.type === 'Product')!;
    const archNode = nodes.find((n) => n.type === 'Architecture')!;
    const uxNode = nodes.find((n) => n.type === 'UX')!;
    const implNode = nodes.find((n) => n.type === 'Implementation')!;
    const qaNode = nodes.find((n) => n.type === 'QA')!;
    const secNode = nodes.find((n) => n.type === 'Security')!;

    for (const nodeId of [reqNode.nodeId, prodNode.nodeId, archNode.nodeId, uxNode.nodeId, implNode.nodeId]) {
      await state.persistentWorkGraph!.setNodeStatus(graph, 'proj-qa-sec-grounded', nodeId, 'InProgress');
      await state.persistentWorkGraph!.setNodeStatus(graph, 'proj-qa-sec-grounded', nodeId, 'Review');
      await state.persistentWorkGraph!.setNodeStatus(graph, 'proj-qa-sec-grounded', nodeId, 'Accepted');
    }

    // Seed prior implementation task to verify upstream context inclusion
    await state.taskStore!.create(
      {
        epicId: 'epic-proj-qa-sec-grounded',
        projectId: 'proj-qa-sec-grounded',
        title: 'Implementation',
        description: 'Implemented AuthMiddleware in app/Http/Middleware/Authenticate.php with unit tests.',
        acceptanceCriteria: ['Change implemented'],
      },
      'corr-test',
    );

    const { status, json } = await request(server, 'POST', '/v1/work-graph/proj-qa-sec-grounded/plan', {
      approver: 'human.ceo',
    });
    expect(status).toBe(202);

    const taskIdsByNodeId = json.taskIdsByNodeId as Record<string, string[]>;
    expect(taskIdsByNodeId[qaNode.nodeId]).toBeDefined();
    expect(taskIdsByNodeId[secNode.nodeId]).toBeDefined();

    // Check QA task
    const qaTaskId = taskIdsByNodeId[qaNode.nodeId]![0]!;
    const qaTask = await state.taskStore!.get(qaTaskId);
    expect(qaTask?.description).toContain('Verify functional, UI, and non-functional quality');
    expect(qaTask?.description).toContain(requirement.problem);
    expect(qaTask?.description).toContain(requirement.desiredOutcome);
    expect(qaTask?.description).toContain('Implementation context: Implemented AuthMiddleware');
    expect(qaTask?.acceptanceCriteria).toContain('All endpoints reject unauthenticated requests with 401.');
    expect(qaTask?.acceptanceCriteria).toContain('Test plan results artifact submitted for human review gate');

    // Check Security task
    const secTaskId = taskIdsByNodeId[secNode.nodeId]![0]!;
    const secTask = await state.taskStore!.get(secTaskId);
    expect(secTask?.description).toContain('Conduct static security audit');
    expect(secTask?.description).toContain(requirement.problem);
    expect(secTask?.description).toContain(requirement.desiredOutcome);
    expect(secTask?.description).toContain('Implementation context: Implemented AuthMiddleware');
    expect(secTask?.acceptanceCriteria).toContain('All endpoints reject unauthenticated requests with 401.');
    expect(secTask?.acceptanceCriteria).toContain('Security report artifact submitted for human review gate');
  });

  it('grounds Release and Operations tasks in the Requirement problem, constraints, acceptance criteria, and prior context', async () => {
    state.requirementStore = new InMemoryRequirementStore();
    connectRequirementWorkGraphBridge(state);
    const projectId = 'proj-rel-ops-grounded';
    const requirement = await state.requirementStore.create({
      projectId,
      title: 'Production release pipeline',
      problem: 'Ship verified changes to production with tested rollback.',
      desiredOutcome: 'Safe deployment with operational health verification.',
      constraints: ['Zero downtime during deploy', 'Kubernetes Helm deployment'],
      acceptanceCriteria: ['Health probe checks must pass 100% on port 8080 and 4000.'],
      assumptions: ['Cluster has ingress-nginx available'],
      openQuestions: [],
      source: { kind: 'Request', label: 'Release pipeline request' },
    });

    // Create prior tasks
    await state.taskStore!.create(
      {
        epicId: `epic-${projectId}`,
        projectId,
        title: 'Implementation: Core Service Changes',
        description: 'Implemented Helm chart manifests and Dockerfiles',
        status: 'Done',
        acceptanceCriteria: ['Done'],
      },
      'corr-test',
    );
    await state.taskStore!.create(
      {
        epicId: `epic-${projectId}`,
        projectId,
        title: 'QA: Release verification plan',
        description: 'Passed 42 smoke and integration tests',
        status: 'Done',
        acceptanceCriteria: ['Done'],
      },
      'corr-test',
    );
    await state.taskStore!.create(
      {
        epicId: `epic-${projectId}`,
        projectId,
        title: 'Security Review: Static Audit',
        description: 'Zero critical or high CVEs identified',
        status: 'Done',
        acceptanceCriteria: ['Done'],
      },
      'corr-test',
    );

    // Fast-forward upstream nodes to Accepted so Release becomes Ready
    const graph = await state.persistentWorkGraph!.load(projectId);
    const nodes = graph.listNodes(projectId);
    for (const type of ['Requirements', 'Product', 'Architecture', 'UX', 'Implementation', 'QA', 'Security'] as const) {
      const n = nodes.find((node) => node.type === type)!;
      await state.persistentWorkGraph!.setNodeStatus(graph, projectId, n.nodeId, 'InProgress');
      await state.persistentWorkGraph!.setNodeStatus(graph, projectId, n.nodeId, 'Review');
      await state.persistentWorkGraph!.setNodeStatus(graph, projectId, n.nodeId, 'Accepted');
    }

    // Release is now Ready!
    const planRes = await request(server, 'POST', `/v1/work-graph/${projectId}/plan`, { approver: 'human.ceo' });
    expect(planRes.status).toBe(202);

    const tasksAfterRelease = await state.taskStore!.list({ projectId });
    const releaseTask = tasksAfterRelease.find((t) => t.title === 'Release');
    expect(releaseTask).toBeDefined();
    expect(releaseTask?.description).toContain('Prepare deployment-ready ReleasePackage');
    expect(releaseTask?.description).toContain(requirement.problem);
    expect(releaseTask?.description).toContain(requirement.desiredOutcome);
    expect(releaseTask?.description).toContain('Implementation context: Implemented Helm chart manifests');
    expect(releaseTask?.description).toContain('QA context: Passed 42 smoke and integration tests');
    expect(releaseTask?.description).toContain('Security context: Zero critical or high CVEs identified');
    expect(releaseTask?.acceptanceCriteria).toContain('ReleasePackage artifact assembled with target manifests and verified quality gate sign-offs');
    expect(releaseTask?.acceptanceCriteria).toContain('Actionable rollback plan defined with explicit steps and verification criteria');

    // Accept Release, so Operations unblocks to Ready!
    const releaseNode = nodes.find((node) => node.type === 'Release')!;
    await state.persistentWorkGraph!.setNodeStatus(graph, projectId, releaseNode.nodeId, 'InProgress');
    await state.persistentWorkGraph!.setNodeStatus(graph, projectId, releaseNode.nodeId, 'Review');
    await state.persistentWorkGraph!.setNodeStatus(graph, projectId, releaseNode.nodeId, 'Accepted');

    const planOpsRes = await request(server, 'POST', `/v1/work-graph/${projectId}/plan`, { approver: 'human.ceo' });
    expect(planOpsRes.status).toBe(202);

    const tasksAfterOps = await state.taskStore!.list({ projectId });
    const opsTask = tasksAfterOps.find((t) => t.title === 'Operations');
    expect(opsTask).toBeDefined();
    expect(opsTask?.description).toContain('Verify deployment health');
    expect(opsTask?.description).toContain(requirement.problem);
    expect(opsTask?.description).toContain(requirement.desiredOutcome);
    expect(opsTask?.description).toContain('Release context: Prepare deployment-ready ReleasePackage');
    expect(opsTask?.acceptanceCriteria).toContain('Deployment health verified across all service probes (control-api, gateway, workers, web)');
    expect(opsTask?.acceptanceCriteria).toContain('Truthful production status and incident log updated with operational evidence');
  });

  it('responds 503 when the message fabric is not connected', async () => {
    state.fabric = undefined;
    await request(server, 'POST', '/v1/work-graph/proj-2/decompose', {});

    const { status } = await request(server, 'POST', '/v1/work-graph/proj-2/plan', { approver: 'human.ceo' });
    expect(status).toBe(503);
  });
});
