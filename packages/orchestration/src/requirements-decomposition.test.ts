import { describe, expect, it } from 'vitest';
import {
  applyRequirementDecomposition,
  decomposeRequirementIntoWorkGraph,
} from './requirements-decomposition.js';
import { InMemoryWorkGraphStore, PersistentWorkGraph } from './work-graph-store.js';

describe('decomposeRequirementIntoWorkGraph', () => {
  it('builds all 9 pipeline nodes for the project, each schema-valid', () => {
    const { nodes } = decomposeRequirementIntoWorkGraph({ projectId: 'proj-1' });
    expect(nodes.map((n) => n.type).sort()).toEqual(
      [
        'Architecture',
        'Implementation',
        'Operations',
        'Product',
        'QA',
        'Release',
        'Requirements',
        'Security',
        'UX',
      ].sort(),
    );
    expect(nodes.every((n) => n.projectId === 'proj-1')).toBe(true);
    expect(nodes.every((n) => n.status === 'Planned')).toBe(true);
  });

  it('produces a graph with no cycles and Architecture/UX both required by Implementation', () => {
    const { edges } = decomposeRequirementIntoWorkGraph({ projectId: 'proj-1' });
    // Constructing a WorkGraph from these would throw on any cycle/duplicate/mismatch —
    // see applyRequirementDecomposition's test below for the full persisted proof.
    const implRequires = edges.filter((e) => e.fromNodeId.endsWith('-implementation') && e.type === 'requires');
    expect(implRequires.map((e) => e.toNodeId).sort()).toEqual(
      ['proj-1-architecture', 'proj-1-ux'].sort(),
    );
  });

  it('carries the real requirementId onto all decomposed nodes for complete lineage', () => {
    const { nodes } = decomposeRequirementIntoWorkGraph({ projectId: 'proj-1', requirementId: 'req-1' });
    const byType = new Map(nodes.map((n) => [n.type, n]));
    expect(byType.get('Requirements')?.metadata.annotations?.requirementId).toBe('req-1');
    expect(byType.get('Product')?.metadata.annotations?.requirementId).toBe('req-1');
    expect(byType.get('Architecture')?.metadata.annotations?.requirementId).toBe('req-1');
    expect(byType.get('UX')?.metadata.annotations?.requirementId).toBe('req-1');
    expect(byType.get('Implementation')?.metadata.annotations?.requirementId).toBe('req-1');
    expect(byType.get('QA')?.metadata.annotations?.requirementId).toBe('req-1');
    expect(byType.get('Security')?.metadata.annotations?.requirementId).toBe('req-1');
    expect(byType.get('Release')?.metadata.annotations?.requirementId).toBe('req-1');
    expect(byType.get('Operations')?.metadata.annotations?.requirementId).toBe('req-1');
    expect(byType.get('Requirements')?.title).toBe('Requirements: req-1');
    expect(byType.get('Product')?.title).toBe('Product Definition');
    expect(byType.get('Architecture')?.title).toBe('Architecture');
    expect(byType.get('UX')?.title).toBe('UX Design');
    expect(byType.get('Implementation')?.title).toBe('Implementation');
    expect(byType.get('QA')?.title).toBe('QA');
    expect(byType.get('Security')?.title).toBe('Security Review');
    expect(byType.get('Release')?.title).toBe('Release');
    expect(byType.get('Operations')?.title).toBe('Operations');
  });

  it('namespaces ids by slug so two decompositions in the same project graph do not collide', () => {
    const a = decomposeRequirementIntoWorkGraph({ projectId: 'proj-1', slug: 'feature-a' });
    const b = decomposeRequirementIntoWorkGraph({ projectId: 'proj-1', slug: 'feature-b' });
    const idsA = new Set(a.nodes.map((n) => n.nodeId));
    const idsB = new Set(b.nodes.map((n) => n.nodeId));
    expect([...idsA].some((id) => idsB.has(id))).toBe(false);
  });
});

describe('applyRequirementDecomposition', () => {
  it('persists a valid, ready-computed graph: only Requirements starts Ready', async () => {
    const store = new InMemoryWorkGraphStore();
    const persistentGraph = new PersistentWorkGraph(store);

    await applyRequirementDecomposition(persistentGraph, { projectId: 'proj-1' });

    const graph = await persistentGraph.load('proj-1');
    const byType = new Map(graph.listNodes('proj-1').map((n) => [n.type, n.status]));
    expect(byType.get('Requirements')).toBe('Ready');
    expect(byType.get('Product')).toBe('Blocked');
    expect(byType.get('Architecture')).toBe('Blocked');
    expect(byType.get('UX')).toBe('Blocked');
    expect(byType.get('Implementation')).toBe('Blocked');
    expect(byType.get('QA')).toBe('Blocked');
    expect(byType.get('Security')).toBe('Blocked');
    expect(byType.get('Release')).toBe('Blocked');
    expect(byType.get('Operations')).toBe('Blocked');
  });

  it('unblocks Architecture and UX (but not yet Implementation) once Requirements and Product are both Accepted', async () => {
    const store = new InMemoryWorkGraphStore();
    const persistentGraph = new PersistentWorkGraph(store);
    await applyRequirementDecomposition(persistentGraph, { projectId: 'proj-1' });

    let graph = await persistentGraph.load('proj-1');
    const requirementsId = graph.listNodes('proj-1').find((n) => n.type === 'Requirements')!.nodeId;
    const productId = graph.listNodes('proj-1').find((n) => n.type === 'Product')!.nodeId;

    for (const nodeId of [requirementsId]) {
      await persistentGraph.setNodeStatus(graph, 'proj-1', nodeId, 'InProgress');
      await persistentGraph.setNodeStatus(graph, 'proj-1', nodeId, 'Review');
      await persistentGraph.setNodeStatus(graph, 'proj-1', nodeId, 'Accepted');
    }

    graph = await persistentGraph.load('proj-1');
    let byType = new Map(graph.listNodes('proj-1').map((n) => [n.type, n.status]));
    expect(byType.get('Product')).toBe('Ready');
    expect(byType.get('Architecture')).toBe('Blocked');

    await persistentGraph.setNodeStatus(graph, 'proj-1', productId, 'InProgress');
    await persistentGraph.setNodeStatus(graph, 'proj-1', productId, 'Review');
    await persistentGraph.setNodeStatus(graph, 'proj-1', productId, 'Accepted');

    graph = await persistentGraph.load('proj-1');
    byType = new Map(graph.listNodes('proj-1').map((n) => [n.type, n.status]));
    expect(byType.get('Architecture')).toBe('Ready');
    expect(byType.get('UX')).toBe('Ready');
    expect(byType.get('Implementation')).toBe('Blocked'); // still needs both Architecture AND UX Accepted

    const archId = graph.listNodes('proj-1').find((n) => n.type === 'Architecture')!.nodeId;
    const uxId = graph.listNodes('proj-1').find((n) => n.type === 'UX')!.nodeId;

    await persistentGraph.setNodeStatus(graph, 'proj-1', archId, 'InProgress');
    await persistentGraph.setNodeStatus(graph, 'proj-1', archId, 'Review');
    await persistentGraph.setNodeStatus(graph, 'proj-1', archId, 'Accepted');

    graph = await persistentGraph.load('proj-1');
    byType = new Map(graph.listNodes('proj-1').map((n) => [n.type, n.status]));
    expect(byType.get('Implementation')).toBe('Blocked'); // UX still not Accepted

    await persistentGraph.setNodeStatus(graph, 'proj-1', uxId, 'InProgress');
    await persistentGraph.setNodeStatus(graph, 'proj-1', uxId, 'Review');
    await persistentGraph.setNodeStatus(graph, 'proj-1', uxId, 'Accepted');

    graph = await persistentGraph.load('proj-1');
    byType = new Map(graph.listNodes('proj-1').map((n) => [n.type, n.status]));
    expect(byType.get('Implementation')).toBe('Ready');
  });

  it('unblocks QA and Security once Implementation is Accepted, and gates Release until both are Accepted', async () => {
    const store = new InMemoryWorkGraphStore();
    const persistentGraph = new PersistentWorkGraph(store);
    await applyRequirementDecomposition(persistentGraph, { projectId: 'proj-1' });

    let graph = await persistentGraph.load('proj-1');
    const nodes = graph.listNodes('proj-1');
    const requirementsId = nodes.find((n) => n.type === 'Requirements')!.nodeId;
    const productId = nodes.find((n) => n.type === 'Product')!.nodeId;
    const archId = nodes.find((n) => n.type === 'Architecture')!.nodeId;
    const uxId = nodes.find((n) => n.type === 'UX')!.nodeId;
    const implId = nodes.find((n) => n.type === 'Implementation')!.nodeId;
    const qaId = nodes.find((n) => n.type === 'QA')!.nodeId;
    const secId = nodes.find((n) => n.type === 'Security')!.nodeId;

    // Fast-forward upstream nodes to Accepted
    for (const id of [requirementsId, productId, archId, uxId]) {
      await persistentGraph.setNodeStatus(graph, 'proj-1', id, 'InProgress');
      await persistentGraph.setNodeStatus(graph, 'proj-1', id, 'Review');
      await persistentGraph.setNodeStatus(graph, 'proj-1', id, 'Accepted');
    }

    graph = await persistentGraph.load('proj-1');
    let byType = new Map(graph.listNodes('proj-1').map((n) => [n.type, n.status]));
    expect(byType.get('Implementation')).toBe('Ready');
    expect(byType.get('QA')).toBe('Blocked');
    expect(byType.get('Security')).toBe('Blocked');
    expect(byType.get('Release')).toBe('Blocked');

    // Move Implementation to Accepted
    await persistentGraph.setNodeStatus(graph, 'proj-1', implId, 'InProgress');
    await persistentGraph.setNodeStatus(graph, 'proj-1', implId, 'Review');
    await persistentGraph.setNodeStatus(graph, 'proj-1', implId, 'Accepted');

    // Both QA and Security are unblocked to Ready; Release is STILL Blocked
    graph = await persistentGraph.load('proj-1');
    byType = new Map(graph.listNodes('proj-1').map((n) => [n.type, n.status]));
    expect(byType.get('QA')).toBe('Ready');
    expect(byType.get('Security')).toBe('Ready');
    expect(byType.get('Release')).toBe('Blocked');

    // Only QA is Accepted: Release is STILL Blocked
    await persistentGraph.setNodeStatus(graph, 'proj-1', qaId, 'InProgress');
    await persistentGraph.setNodeStatus(graph, 'proj-1', qaId, 'Review');
    await persistentGraph.setNodeStatus(graph, 'proj-1', qaId, 'Accepted');

    graph = await persistentGraph.load('proj-1');
    byType = new Map(graph.listNodes('proj-1').map((n) => [n.type, n.status]));
    expect(byType.get('QA')).toBe('Accepted');
    expect(byType.get('Security')).toBe('Ready');
    expect(byType.get('Release')).toBe('Blocked'); // Security not yet Accepted

    // Both QA and Security are Accepted: Release transitions to Ready, Operations is STILL Blocked
    await persistentGraph.setNodeStatus(graph, 'proj-1', secId, 'InProgress');
    await persistentGraph.setNodeStatus(graph, 'proj-1', secId, 'Review');
    await persistentGraph.setNodeStatus(graph, 'proj-1', secId, 'Accepted');

    graph = await persistentGraph.load('proj-1');
    byType = new Map(graph.listNodes('proj-1').map((n) => [n.type, n.status]));
    expect(byType.get('QA')).toBe('Accepted');
    expect(byType.get('Security')).toBe('Accepted');
    expect(byType.get('Release')).toBe('Ready');
    expect(byType.get('Operations')).toBe('Blocked');

    // Move Release to Accepted: Operations unblocks to Ready!
    const releaseId = nodes.find((n) => n.type === 'Release')!.nodeId;
    await persistentGraph.setNodeStatus(graph, 'proj-1', releaseId, 'InProgress');
    await persistentGraph.setNodeStatus(graph, 'proj-1', releaseId, 'Review');
    await persistentGraph.setNodeStatus(graph, 'proj-1', releaseId, 'Accepted');

    graph = await persistentGraph.load('proj-1');
    byType = new Map(graph.listNodes('proj-1').map((n) => [n.type, n.status]));
    expect(byType.get('Release')).toBe('Accepted');
    expect(byType.get('Operations')).toBe('Ready');
  });
});
