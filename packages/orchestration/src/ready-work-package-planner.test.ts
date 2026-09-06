import { describe, expect, it, vi } from 'vitest';
import { Orchestrator } from './orchestrator.js';
import { InMemoryWorkPackageStore } from './store.js';
import { InMemoryWorkGraphStore, PersistentWorkGraph } from './work-graph-store.js';
import { ReadyWorkPackagePlanner, type ReadyWorkPackagePlannerOptions } from './ready-work-package-planner.js';
import { OrchestrationError } from './errors.js';
import { createMockClock, createTestWorkGraphEdge, createTestWorkGraphNode } from './test-utils.js';
import type { EventPublisher } from './events.js';
import type { WorkPackageDispatcher } from './dispatcher.js';

const VALID_EXECUTION = { execId: 'EXEC-001', contextHandle: 'ctx-1', correlationId: 'corr-1' };

function createTestPlanner(overrides: Partial<ReadyWorkPackagePlannerOptions> = {}) {
  const store = new InMemoryWorkPackageStore();
  const events: EventPublisher = { publish: vi.fn(async () => undefined) };
  const dispatcher: WorkPackageDispatcher = { dispatch: vi.fn(async () => undefined) };
  const orchestrator = new Orchestrator({ store, events, dispatcher, clock: createMockClock() });

  const graphStore = new InMemoryWorkGraphStore();
  const persistentGraph = new PersistentWorkGraph(graphStore);

  const planner = new ReadyWorkPackagePlanner({
    orchestrator,
    persistentGraph,
    resolveSpecialist: () => ({
      specialistId: 'eng.app-delivery',
      specialistSpecVersion: '1.0.0',
      specialistSpecHash: 'hash-1',
    }),
    resolveTaskContext: () => ({ taskIds: ['task-1'] }),
    ...overrides,
  });

  return { planner, orchestrator, dispatcher, graphStore, persistentGraph };
}

describe('ReadyWorkPackagePlanner', () => {
  it('fails closed when execId is missing', async () => {
    const { planner } = createTestPlanner();
    await expect(
      planner.planProject('proj-1', { execId: '', contextHandle: 'ctx-1', correlationId: 'corr-1' }),
    ).rejects.toThrow(OrchestrationError);
  });

  it('fails closed when contextHandle is missing', async () => {
    const { planner } = createTestPlanner();
    await expect(
      planner.planProject('proj-1', { execId: 'EXEC-1', contextHandle: '', correlationId: 'corr-1' }),
    ).rejects.toThrow(OrchestrationError);
  });

  it('fails closed when correlationId is missing', async () => {
    const { planner } = createTestPlanner();
    await expect(
      planner.planProject('proj-1', { execId: 'EXEC-1', contextHandle: 'ctx-1', correlationId: '' }),
    ).rejects.toThrow(OrchestrationError);
  });

  it('creates and dispatches a real Work Package for a ready node', async () => {
    const { planner, graphStore, dispatcher } = createTestPlanner();
    await graphStore.saveNode(createTestWorkGraphNode({ nodeId: 'requirements', status: 'Planned' }));

    const result = await planner.planProject('proj-1', VALID_EXECUTION);

    expect(result.skipped).toEqual([]);
    expect(result.created).toHaveLength(1);
    const wp = result.created[0]!;
    expect(wp.execId).toBe('EXEC-001');
    expect(wp.contextHandle).toBe('ctx-1');
    expect(wp.specialistId).toBe('eng.app-delivery');
    expect(wp.taskIds).toEqual(['task-1']);
    expect(wp.status).toBe('Dispatched');
    expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);

    const node = (await graphStore.listNodes('proj-1')).find((n) => n.nodeId === 'requirements');
    expect(node?.workPackageId).toBe(wp.workPackageId);
  });

  it('skips a ready node when no Task ids can be resolved, without creating a Work Package', async () => {
    const { planner, graphStore } = createTestPlanner({ resolveTaskContext: () => undefined });
    await graphStore.saveNode(createTestWorkGraphNode({ nodeId: 'requirements', status: 'Planned' }));

    const result = await planner.planProject('proj-1', VALID_EXECUTION);

    expect(result.created).toEqual([]);
    expect(result.skipped).toEqual([
      { nodeId: 'requirements', nodeType: 'Requirements', reason: expect.stringContaining('Task ids') },
    ]);
  });

  it('skips a ready node when no active Specialist can be resolved', async () => {
    const { planner, graphStore } = createTestPlanner({ resolveSpecialist: () => undefined });
    await graphStore.saveNode(createTestWorkGraphNode({ nodeId: 'requirements', status: 'Planned' }));

    const result = await planner.planProject('proj-1', VALID_EXECUTION);

    expect(result.created).toEqual([]);
    expect(result.skipped).toEqual([
      { nodeId: 'requirements', nodeType: 'Requirements', reason: expect.stringContaining('Specialist') },
    ]);
  });

  it('builds metadata.annotations.instruction from real taskDetails when the resolver supplies them', async () => {
    const { planner, graphStore } = createTestPlanner({
      resolveTaskContext: () => ({
        taskIds: ['task-1'],
        taskDetails: [{ taskId: 'task-1', title: 'Audit checkout flow', description: 'Review the checkout UX for gaps.' }],
      }),
    });
    await graphStore.saveNode(createTestWorkGraphNode({ nodeId: 'requirements', status: 'Planned' }));

    const result = await planner.planProject('proj-1', VALID_EXECUTION);

    const instruction = result.created[0]!.metadata.annotations?.instruction;
    expect(instruction).toContain('Audit checkout flow');
    expect(instruction).toContain('Review the checkout UX for gaps.');
  });

  it('leaves metadata.annotations empty when the resolver supplies no taskDetails (never fabricated)', async () => {
    const { planner, graphStore } = createTestPlanner();
    await graphStore.saveNode(createTestWorkGraphNode({ nodeId: 'requirements', status: 'Planned' }));

    const result = await planner.planProject('proj-1', VALID_EXECUTION);

    expect(result.created[0]!.metadata.annotations?.instruction).toBeUndefined();
  });

  it('never re-plans a node that already has a Work Package attached', async () => {
    const { planner, graphStore } = createTestPlanner();
    await graphStore.saveNode(createTestWorkGraphNode({ nodeId: 'requirements', status: 'Planned' }));

    const first = await planner.planProject('proj-1', VALID_EXECUTION);
    expect(first.created).toHaveLength(1);

    const second = await planner.planProject('proj-1', VALID_EXECUTION);
    expect(second.created).toEqual([]);
    expect(second.skipped).toEqual([]);
  });

  it('does not plan a node still Blocked on an unfinished predecessor', async () => {
    const { planner, graphStore } = createTestPlanner();
    await graphStore.saveNode(createTestWorkGraphNode({ nodeId: 'requirements', status: 'Planned' }));
    await graphStore.saveNode(
      createTestWorkGraphNode({ nodeId: 'product', type: 'Product', title: 'Product', status: 'Planned' }),
    );
    await graphStore.saveEdge(
      createTestWorkGraphEdge({
        edgeId: 'e1',
        fromNodeId: 'requirements',
        toNodeId: 'product',
        type: 'blocks',
      }),
    );

    const result = await planner.planProject('proj-1', VALID_EXECUTION);

    // Only 'requirements' (no predecessors) is Ready; 'product' stays Blocked until requirements is Accepted.
    expect(result.created).toHaveLength(1);
    expect(result.created[0]!.workPackageId).toBe('wp-requirements');
    expect(result.skipped).toEqual([]);
  });
});
