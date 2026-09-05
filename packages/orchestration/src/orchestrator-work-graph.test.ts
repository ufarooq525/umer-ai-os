import { describe, expect, it, vi } from 'vitest';
import { SCHEMA_VERSION } from '@umer/contracts';
import { createCommandEnvelope, createEventEnvelope } from '@umer/message-fabric';
import type { CommandHandler, EventHandler } from '@umer/message-fabric';
import { Orchestrator } from './orchestrator.js';
import { InMemoryWorkPackageStore } from './store.js';
import { OrchestrationWorker } from './worker.js';
import { ORCHESTRATION_COMMANDS } from './constants.js';
import { InMemoryWorkGraphStore, PersistentWorkGraph } from './work-graph-store.js';
import { WorkGraphProjector } from './work-graph-projector.js';
import { ReadyWorkPackagePlanner } from './ready-work-package-planner.js';
import { createMockClock, createTestWorkGraphEdge, createTestWorkGraphNode } from './test-utils.js';
import type { EventPublisher } from './events.js';
import type { WorkPackageDispatcher } from './dispatcher.js';

const ackCtx = { correlationId: 'corr-1', deliveryCount: 1, ack: vi.fn(), nak: vi.fn(), term: vi.fn() };

/**
 * End-to-end proof of the full pipeline named in the product vision:
 * Work Graph → Ready Work Package Planner → Work Package → Orchestrator →
 * (simulated Agent Worker events) → Orchestrator → Work Graph.
 * No fake IDs: every Work Package below is a real one the planner built from
 * a real graph node, and every status transition below is the Orchestrator's
 * real state machine — this test only fakes the Message Fabric transport.
 */
async function createHarness() {
  const wpStore = new InMemoryWorkPackageStore();
  const events: EventPublisher = { publish: vi.fn(async () => undefined) };
  const dispatcher: WorkPackageDispatcher = { dispatch: vi.fn(async () => undefined) };
  const orchestrator = new Orchestrator({ store: wpStore, events, dispatcher, clock: createMockClock() });

  const graphStore = new InMemoryWorkGraphStore();
  const persistentGraph = new PersistentWorkGraph(graphStore);
  const projector = new WorkGraphProjector(persistentGraph, graphStore);

  const planner = new ReadyWorkPackagePlanner({
    orchestrator,
    persistentGraph,
    resolveSpecialist: () => ({
      specialistId: 'eng.app-delivery',
      specialistSpecVersion: '1.0.0',
      specialistSpecHash: 'hash-1',
    }),
    resolveTaskContext: () => ({ taskIds: ['task-1'] }),
    dispatch: false, // dispatch separately below, mirroring real usage (queue via planner, dispatch via command)
  });

  let commandHandler: CommandHandler = async () => undefined;
  let eventHandler: EventHandler = async () => undefined;
  const fabric = {
    subscribeCommands: vi.fn(async (_opts: unknown, handler: CommandHandler) => {
      commandHandler = handler;
      return { stop: vi.fn(async () => undefined) };
    }),
    subscribeEvents: vi.fn(async (_opts: unknown, handler: EventHandler) => {
      eventHandler = handler;
      return { stop: vi.fn(async () => undefined) };
    }),
  };

  const worker = new OrchestrationWorker({
    orchestrator,
    fabric: fabric as never,
    workGraphProjector: projector,
  });
  await worker.start();

  return { orchestrator, graphStore, persistentGraph, planner, commandHandler, eventHandler };
}

describe('Work Graph <-> Orchestrator (end-to-end)', () => {
  it('drives a Requirements node Ready -> InProgress -> Review -> Accepted, unblocking its dependent Product node', async () => {
    const { graphStore, planner, commandHandler, eventHandler } = await createHarness();

    await graphStore.saveNode(
      createTestWorkGraphNode({ nodeId: 'requirements', type: 'Requirements', title: 'Requirements', status: 'Planned' }),
    );
    await graphStore.saveNode(
      createTestWorkGraphNode({ nodeId: 'product', type: 'Product', title: 'Product', status: 'Planned' }),
    );
    await graphStore.saveEdge(
      createTestWorkGraphEdge({ edgeId: 'e1', fromNodeId: 'requirements', toNodeId: 'product', type: 'blocks' }),
    );

    const plan = await planner.planProject('proj-1', {
      execId: 'EXEC-001',
      contextHandle: 'ctx-1',
      correlationId: 'corr-1',
    });
    expect(plan.created).toHaveLength(1);
    const workPackageId = plan.created[0]!.workPackageId;

    let nodes = await graphStore.listNodes('proj-1');
    expect(nodes.find((n) => n.nodeId === 'requirements')?.status).toBe('Ready');
    expect(nodes.find((n) => n.nodeId === 'requirements')?.workPackageId).toBe(workPackageId);
    expect(nodes.find((n) => n.nodeId === 'product')?.status).toBe('Blocked');

    await commandHandler(
      createCommandEnvelope({
        name: ORCHESTRATION_COMMANDS.DISPATCH,
        producer: 'control-api',
        correlationId: 'corr-1',
        payload: { workPackageId },
      }),
      ackCtx,
    );

    await eventHandler(
      createEventEnvelope({
        name: 'agent.run.started',
        producer: 'agent-worker',
        correlationId: 'corr-1',
        payload: { workPackageId },
      }),
      ackCtx,
    );
    nodes = await graphStore.listNodes('proj-1');
    expect(nodes.find((n) => n.nodeId === 'requirements')?.status).toBe('InProgress');

    await eventHandler(
      createEventEnvelope({
        name: 'agent.run.completed',
        producer: 'agent-worker',
        correlationId: 'corr-1',
        payload: { workPackageId, artifactId: 'art-1' },
      }),
      ackCtx,
    );
    nodes = await graphStore.listNodes('proj-1');
    expect(nodes.find((n) => n.nodeId === 'requirements')?.status).toBe('Review');
    // Downstream node is still blocked — the review hasn't been accepted yet.
    expect(nodes.find((n) => n.nodeId === 'product')?.status).toBe('Blocked');

    await commandHandler(
      createCommandEnvelope({
        name: ORCHESTRATION_COMMANDS.ACCEPT,
        producer: 'control-api',
        correlationId: 'corr-1',
        payload: { workPackageId },
      }),
      ackCtx,
    );
    nodes = await graphStore.listNodes('proj-1');
    expect(nodes.find((n) => n.nodeId === 'requirements')?.status).toBe('Accepted');
    // Accepting 'requirements' unblocks 'product' via recomputeReadiness cascade.
    expect(nodes.find((n) => n.nodeId === 'product')?.status).toBe('Ready');

    // The now-Ready 'product' node has no Work Package yet — planning again picks it up.
    const secondPlan = await planner.planProject('proj-1', {
      execId: 'EXEC-001',
      contextHandle: 'ctx-1',
      correlationId: 'corr-1',
    });
    expect(secondPlan.created).toHaveLength(1);
    expect(secondPlan.created[0]!.stage).toBe('Product');
  });

  it('projects a rejected review back onto the graph node as Failed', async () => {
    const { graphStore, planner, commandHandler, eventHandler } = await createHarness();
    await graphStore.saveNode(createTestWorkGraphNode({ nodeId: 'requirements', status: 'Planned' }));

    const plan = await planner.planProject('proj-1', {
      execId: 'EXEC-001',
      contextHandle: 'ctx-1',
      correlationId: 'corr-1',
    });
    const workPackageId = plan.created[0]!.workPackageId;

    await commandHandler(
      createCommandEnvelope({
        name: ORCHESTRATION_COMMANDS.DISPATCH,
        producer: 'control-api',
        correlationId: 'corr-1',
        payload: { workPackageId },
      }),
      ackCtx,
    );
    await eventHandler(
      createEventEnvelope({
        name: 'agent.run.started',
        producer: 'agent-worker',
        correlationId: 'corr-1',
        payload: { workPackageId },
      }),
      ackCtx,
    );
    await eventHandler(
      createEventEnvelope({
        name: 'agent.run.completed',
        producer: 'agent-worker',
        correlationId: 'corr-1',
        payload: { workPackageId },
      }),
      ackCtx,
    );
    await commandHandler(
      createCommandEnvelope({
        name: ORCHESTRATION_COMMANDS.REJECT,
        producer: 'control-api',
        correlationId: 'corr-1',
        payload: { workPackageId, reason: 'missing coverage' },
      }),
      ackCtx,
    );

    const node = (await graphStore.listNodes('proj-1')).find((n) => n.nodeId === 'requirements');
    expect(node?.status).toBe('Failed');
  });

  it('leaves a Work Package with no originating graph node untouched (no-op, not an error)', async () => {
    const { graphStore, commandHandler } = await createHarness();
    // No graph node created at all for this Work Package — mirrors the separate
    // audit-pipeline intake flow, which dispatches real work through the same
    // Orchestrator without ever touching a Work Graph.
    await expect(
      commandHandler(
        createCommandEnvelope({
          name: ORCHESTRATION_COMMANDS.QUEUE,
          producer: 'control-api',
          correlationId: 'corr-1',
          payload: {
            workPackage: {
              id: 'hdr-wp-orphan',
              schemaVersion: SCHEMA_VERSION,
              createdAt: '2026-09-06T00:00:00.000Z',
              updatedAt: '2026-09-06T00:00:00.000Z',
              metadata: { labels: {}, annotations: {} },
              kind: 'work_package',
              workPackageId: 'wp-orphan',
              execId: 'EXEC-001',
              stage: 'Development',
              status: 'Draft',
              specialistId: 'eng.app-delivery',
              specialistSpecVersion: '1.0.0',
              specialistSpecHash: 'hash-1',
              taskIds: ['task-1'],
              capabilityIds: [],
              contextHandle: 'ctx-1',
              toolAllowlist: [],
              resourceEnvelope: { parallelism: 1 },
              attempt: 1,
              correlationId: 'corr-1',
            },
          },
        }),
        ackCtx,
      ),
    ).resolves.toBeUndefined();
    expect(await graphStore.listNodes('proj-1')).toEqual([]);
  });
});
