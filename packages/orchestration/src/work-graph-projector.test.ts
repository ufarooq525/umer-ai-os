import { describe, expect, it } from 'vitest';
import { InMemoryWorkGraphStore, PersistentWorkGraph } from './work-graph-store.js';
import { WorkGraphProjector } from './work-graph-projector.js';
import { createTestWorkGraphNode } from './test-utils.js';

async function createHarness() {
  const store = new InMemoryWorkGraphStore();
  const persistentGraph = new PersistentWorkGraph(store);
  const projector = new WorkGraphProjector(persistentGraph, store);

  const graph = await persistentGraph.load('proj-1');
  await persistentGraph.addNode(
    graph,
    createTestWorkGraphNode({ nodeId: 'ux', type: 'UX', title: 'UX', status: 'Planned' }),
  );
  await persistentGraph.attachWorkPackage(graph, 'proj-1', 'ux', 'wp-1');

  async function nodeStatus(): Promise<string | undefined> {
    const reloaded = await persistentGraph.load('proj-1');
    return reloaded.listNodes('proj-1').find((n) => n.nodeId === 'ux')?.status;
  }

  return { projector, nodeStatus };
}

describe('WorkGraphProjector', () => {
  it('projects the full happy path: Running -> AwaitingReview -> Accepted', async () => {
    const { projector, nodeStatus } = await createHarness();
    expect(await nodeStatus()).toBe('Ready'); // a freshly-attached, no-predecessor node starts Ready

    await projector.onRunning('wp-1');
    expect(await nodeStatus()).toBe('InProgress');

    await projector.onAwaitingReview('wp-1');
    expect(await nodeStatus()).toBe('Review');

    await projector.onAccepted('wp-1');
    expect(await nodeStatus()).toBe('Accepted');
  });

  it('projects a terminal failure straight to Failed', async () => {
    const { projector, nodeStatus } = await createHarness();
    await projector.onRunning('wp-1');
    await projector.onFailed('wp-1');
    expect(await nodeStatus()).toBe('Failed');
  });

  it('projects a cancellation straight to Cancelled', async () => {
    const { projector, nodeStatus } = await createHarness();
    await projector.onRunning('wp-1');
    await projector.onCancelled('wp-1');
    expect(await nodeStatus()).toBe('Cancelled');
  });

  it('projects a retry as two legal hops (InProgress -> Failed -> Ready), not one illegal one', async () => {
    // Regression test: found live when a real retry-with-redispatch (see
    // worker.ts's agent.run.failed handling) actually exercised this method
    // against a node still InProgress -- the node state machine
    // (NODE_TRANSITIONS in work-graph.ts) has no direct InProgress -> Ready
    // edge, only InProgress -> Failed -> Ready. A single-hop project() call
    // threw "Illegal Work Graph node transition: InProgress -> Ready" every
    // time, and because nothing in this test suite ever attached a real
    // WorkGraphProjector to a retry scenario before, nothing caught it.
    const { projector, nodeStatus } = await createHarness();
    await projector.onRunning('wp-1');
    expect(await nodeStatus()).toBe('InProgress');

    await expect(projector.onRetried('wp-1')).resolves.toBeUndefined();
    expect(await nodeStatus()).toBe('Ready');
  });

  it('is a no-op for a Work Package with no originating Work Graph node', async () => {
    const { projector } = await createHarness();
    await expect(projector.onRunning('wp-does-not-exist')).resolves.toBeUndefined();
    await expect(projector.onRetried('wp-does-not-exist')).resolves.toBeUndefined();
  });
});
