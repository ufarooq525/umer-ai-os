import { describe, expect, it, vi } from 'vitest';
import { createCommandEnvelope } from '@umer/message-fabric';
import type { CommandHandler, EventEnvelope } from '@umer/message-fabric';
import { OrchestrationWorker } from './worker.js';
import { Orchestrator } from './orchestrator.js';
import { InMemoryWorkPackageStore } from './store.js';
import { InMemoryWorkGraphStore, PersistentWorkGraph } from './work-graph-store.js';
import { ORCHESTRATION_COMMANDS } from './constants.js';
import { OrchestrationError } from './errors.js';
import { createMockClock, createTestWorkGraphNode } from './test-utils.js';
import type { EventPublisher } from './events.js';
import type { WorkPackageDispatcher } from './dispatcher.js';

const ackCtx = { correlationId: 'corr-1', deliveryCount: 1, ack: vi.fn(), nak: vi.fn(), term: vi.fn() };

async function createHarness(options: { withPlanning?: boolean } = {}) {
  const wpStore = new InMemoryWorkPackageStore();
  const events: EventPublisher = { publish: vi.fn(async () => undefined) };
  const dispatcher: WorkPackageDispatcher = { dispatch: vi.fn(async () => undefined) };
  const orchestrator = new Orchestrator({ store: wpStore, events, dispatcher, clock: createMockClock() });

  const graphStore = new InMemoryWorkGraphStore();
  const persistentGraph = new PersistentWorkGraph(graphStore);

  let commandHandler: CommandHandler = async () => undefined;
  const publishEvent = vi.fn(async () => undefined);
  const fabric = {
    subscribeCommands: vi.fn(async (_opts: unknown, handler: CommandHandler) => {
      commandHandler = handler;
      return { stop: vi.fn(async () => undefined) };
    }),
    subscribeEvents: vi.fn(async () => ({ stop: vi.fn(async () => undefined) })),
    publishEvent,
  };

  const worker = new OrchestrationWorker({
    orchestrator,
    fabric: fabric as never,
    workGraphPlanning: options.withPlanning
      ? {
          persistentGraph,
          resolveSpecialist: (node) =>
            node.type === 'Implementation'
              ? { specialistId: 'eng.app-delivery', specialistSpecVersion: '1.1.0', specialistSpecHash: 'hash-1' }
              : undefined,
        }
      : undefined,
  });
  await worker.start();

  return { orchestrator, graphStore, commandHandler, publishEvent };
}

describe('OrchestrationWorker — workgraph.plan', () => {
  it('rejects the command when no workGraphPlanning is configured', async () => {
    const { commandHandler } = await createHarness({ withPlanning: false });
    await expect(
      commandHandler(
        createCommandEnvelope({
          name: ORCHESTRATION_COMMANDS.PLAN_PROJECT,
          producer: 'control-api',
          correlationId: 'corr-1',
          payload: { projectId: 'proj-1', execId: 'EXEC-1', contextHandle: 'ctx-1', taskIdsByNodeId: {} },
        }),
        ackCtx,
      ),
    ).rejects.toThrow(OrchestrationError);
  });

  it('plans a real, dispatchable Implementation node using the real task ids supplied in the command', async () => {
    const { graphStore, commandHandler, publishEvent, orchestrator } = await createHarness({ withPlanning: true });
    await graphStore.saveNode(
      createTestWorkGraphNode({ nodeId: 'impl', type: 'Implementation', title: 'Implementation', status: 'Planned' }),
    );

    await commandHandler(
      createCommandEnvelope({
        name: ORCHESTRATION_COMMANDS.PLAN_PROJECT,
        producer: 'control-api',
        correlationId: 'corr-1',
        payload: {
          projectId: 'proj-1',
          execId: 'EXEC-1',
          contextHandle: 'ctx-1',
          taskIdsByNodeId: { impl: ['task-real-1'] },
        },
      }),
      ackCtx,
    );

    const node = (await graphStore.listNodes('proj-1')).find((n) => n.nodeId === 'impl');
    expect(node?.workPackageId).toBeDefined();
    const wp = await orchestrator.get(node!.workPackageId!);
    expect(wp?.taskIds).toEqual(['task-real-1']);
    expect(wp?.specialistId).toBe('eng.app-delivery');

    expect(publishEvent).toHaveBeenCalledTimes(1);
    const [subject, event] = publishEvent.mock.calls[0] as [string, EventEnvelope];
    expect(subject).toBe('evt.runtime.workgraph.planned');
    expect(event.payload).toMatchObject({ projectId: 'proj-1', created: [node!.workPackageId], skipped: [] });
  });

  it('skips a node with no real task ids supplied, and reports it in the published event', async () => {
    const { graphStore, commandHandler, publishEvent } = await createHarness({ withPlanning: true });
    await graphStore.saveNode(
      createTestWorkGraphNode({ nodeId: 'impl', type: 'Implementation', title: 'Implementation', status: 'Planned' }),
    );

    await commandHandler(
      createCommandEnvelope({
        name: ORCHESTRATION_COMMANDS.PLAN_PROJECT,
        producer: 'control-api',
        correlationId: 'corr-1',
        payload: { projectId: 'proj-1', execId: 'EXEC-1', contextHandle: 'ctx-1', taskIdsByNodeId: {} },
      }),
      ackCtx,
    );

    const node = (await graphStore.listNodes('proj-1')).find((n) => n.nodeId === 'impl');
    expect(node?.workPackageId).toBeUndefined();

    const [, event] = publishEvent.mock.calls[0] as [string, EventEnvelope];
    expect((event.payload as { created: unknown[] }).created).toEqual([]);
    expect((event.payload as { skipped: Array<{ nodeId: string }> }).skipped).toEqual([
      { nodeId: 'impl', nodeType: 'Implementation', reason: expect.stringContaining('Task ids') },
    ]);
  });

  it('never fabricates a Specialist for a node type this deployment cannot dispatch to', async () => {
    const { graphStore, commandHandler, publishEvent } = await createHarness({ withPlanning: true });
    await graphStore.saveNode(createTestWorkGraphNode({ nodeId: 'qa', type: 'QA', title: 'QA', status: 'Planned' }));

    await commandHandler(
      createCommandEnvelope({
        name: ORCHESTRATION_COMMANDS.PLAN_PROJECT,
        producer: 'control-api',
        correlationId: 'corr-1',
        payload: { projectId: 'proj-1', execId: 'EXEC-1', contextHandle: 'ctx-1', taskIdsByNodeId: { qa: ['task-1'] } },
      }),
      ackCtx,
    );

    const [, event] = publishEvent.mock.calls[0] as [string, EventEnvelope];
    expect((event.payload as { skipped: Array<{ reason: string }> }).skipped[0]!.reason).toContain('Specialist');
  });
});
