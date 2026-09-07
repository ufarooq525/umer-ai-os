import { describe, expect, it } from 'vitest';
import { applyStandaloneAuditNode, buildStandaloneAuditNode } from './standalone-audit-node.js';
import { InMemoryWorkGraphStore, PersistentWorkGraph } from './work-graph-store.js';
import { createTestWorkGraphNode } from './test-utils.js';

describe('buildStandaloneAuditNode', () => {
  it('builds a schema-valid, edge-free node with a type-appropriate default title', () => {
    const node = buildStandaloneAuditNode({ projectId: 'proj-1', type: 'QA' });
    expect(node.projectId).toBe('proj-1');
    expect(node.type).toBe('QA');
    expect(node.status).toBe('Planned');
    expect(node.title).toBe('QA Audit');
  });

  it('accepts a title override', () => {
    const node = buildStandaloneAuditNode({ projectId: 'proj-1', type: 'Security', title: 'Pre-launch security pass' });
    expect(node.title).toBe('Pre-launch security pass');
  });
});

describe('applyStandaloneAuditNode', () => {
  it('persists the node and it comes out Ready immediately, with no other nodes created', async () => {
    const store = new InMemoryWorkGraphStore();
    const persistentGraph = new PersistentWorkGraph(store);

    const { node } = await applyStandaloneAuditNode(persistentGraph, { projectId: 'proj-1', type: 'UX' });

    const graph = await persistentGraph.load('proj-1');
    const nodes = graph.listNodes('proj-1');
    expect(nodes).toHaveLength(1);
    expect(nodes[0]!.nodeId).toBe(node.nodeId);
    expect(nodes[0]!.status).toBe('Ready');
    expect(graph.listEdges('proj-1')).toHaveLength(0);
  });

  it('lets two audit nodes of different types coexist on the same project without colliding', async () => {
    const store = new InMemoryWorkGraphStore();
    const persistentGraph = new PersistentWorkGraph(store);

    await applyStandaloneAuditNode(persistentGraph, { projectId: 'proj-1', type: 'QA' });
    await applyStandaloneAuditNode(persistentGraph, { projectId: 'proj-1', type: 'Security' });

    const graph = await persistentGraph.load('proj-1');
    const types = graph.listNodes('proj-1').map((n) => n.type).sort();
    expect(types).toEqual(['QA', 'Security']);
    expect(graph.listReadyNodes('proj-1')).toHaveLength(2);
  });

  it('does not disturb an existing decomposition already in flight on the same project', async () => {
    const store = new InMemoryWorkGraphStore();
    const persistentGraph = new PersistentWorkGraph(store);
    let graph = await persistentGraph.load('proj-1');
    await persistentGraph.addNode(
      graph,
      createTestWorkGraphNode({ nodeId: 'proj-1-requirements', status: 'Accepted' }),
    );

    await applyStandaloneAuditNode(persistentGraph, { projectId: 'proj-1', type: 'QA' });

    graph = await persistentGraph.load('proj-1');
    const nodes = graph.listNodes('proj-1');
    expect(nodes).toHaveLength(2);
    expect(nodes.find((n) => n.nodeId === 'proj-1-requirements')!.status).toBe('Accepted');
  });
});
