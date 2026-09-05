import { describe, expect, it } from 'vitest';
import { InMemoryWorkGraphStore, PersistentWorkGraph } from './work-graph-store.js';
import { createTestWorkGraphEdge, createTestWorkGraphNode } from './test-utils.js';

describe('PersistentWorkGraph', () => {
  it('loads an empty graph for a project with nothing persisted yet', async () => {
    const store = new InMemoryWorkGraphStore();
    const persistent = new PersistentWorkGraph(store);
    const graph = await persistent.load('proj-1');
    expect(graph.listNodes('proj-1')).toEqual([]);
  });

  it('persists a node added through addNode, readable back after a fresh load', async () => {
    const store = new InMemoryWorkGraphStore();
    const persistent = new PersistentWorkGraph(store);
    const graph = await persistent.load('proj-1');

    await persistent.addNode(graph, createTestWorkGraphNode({ nodeId: 'a', status: 'Planned' }));

    const reloaded = await persistent.load('proj-1');
    expect(reloaded.getNode('a')?.status).toBe('Ready'); // recomputed on load (no predecessors)

    const stored = await store.listNodes('proj-1');
    expect(stored).toHaveLength(1);
  });

  it('persists only the nodes a status change actually touched, including cascaded unblocks', async () => {
    const store = new InMemoryWorkGraphStore();
    const persistent = new PersistentWorkGraph(store);
    const graph = await persistent.load('proj-1');

    await persistent.addNode(graph, createTestWorkGraphNode({ nodeId: 'a', status: 'Planned' }));
    await persistent.addNode(graph, createTestWorkGraphNode({ nodeId: 'b', status: 'Planned' }));
    await persistent.addEdge(
      graph,
      createTestWorkGraphEdge({ edgeId: 'e1', fromNodeId: 'a', toNodeId: 'b', type: 'blocks' }),
    );

    expect(graph.getNode('a')?.status).toBe('Ready');
    expect(graph.getNode('b')?.status).toBe('Blocked');

    await persistent.setNodeStatus(graph, 'proj-1', 'a', 'InProgress');
    await persistent.setNodeStatus(graph, 'proj-1', 'a', 'Review');
    const changed = await persistent.setNodeStatus(graph, 'proj-1', 'a', 'Accepted');

    // 'a' itself changed, and recomputeReadiness cascaded 'b' from Blocked to Ready.
    expect(changed.map((n) => n.nodeId).sort()).toEqual(['a', 'b']);

    const reloaded = await persistent.load('proj-1');
    expect(reloaded.getNode('a')?.status).toBe('Accepted');
    expect(reloaded.getNode('b')?.status).toBe('Ready');
  });

  it('persists attachWorkPackage so it survives a reload', async () => {
    const store = new InMemoryWorkGraphStore();
    const persistent = new PersistentWorkGraph(store);
    const graph = await persistent.load('proj-1');
    await persistent.addNode(graph, createTestWorkGraphNode({ nodeId: 'a', status: 'Ready' }));

    await persistent.attachWorkPackage(graph, 'proj-1', 'a', 'wp-1');

    const reloaded = await persistent.load('proj-1');
    expect(reloaded.getNode('a')?.workPackageId).toBe('wp-1');
  });

  it('keeps two projects fully isolated', async () => {
    const store = new InMemoryWorkGraphStore();
    const persistent = new PersistentWorkGraph(store);
    const g1 = await persistent.load('proj-1');
    const g2 = await persistent.load('proj-2');

    await persistent.addNode(g1, createTestWorkGraphNode({ nodeId: 'a', projectId: 'proj-1' }));
    await persistent.addNode(g2, createTestWorkGraphNode({ nodeId: 'a', projectId: 'proj-2' }));

    expect((await store.listNodes('proj-1')).map((n) => n.nodeId)).toEqual(['a']);
    expect((await store.listNodes('proj-2')).map((n) => n.nodeId)).toEqual(['a']);
    expect((await store.listNodes('proj-1'))[0]!.projectId).toBe('proj-1');
  });
});
