import { describe, expect, it } from 'vitest';
import { WorkGraph } from './work-graph.js';
import { OrchestrationError } from './errors.js';
import { createTestWorkGraphEdge, createTestWorkGraphNode } from './test-utils.js';

describe('WorkGraph', () => {
  it('rejects a duplicate node', () => {
    const graph = new WorkGraph();
    graph.addNode(createTestWorkGraphNode({ nodeId: 'a' }));
    expect(() => graph.addNode(createTestWorkGraphNode({ nodeId: 'a' }))).toThrow(OrchestrationError);
  });

  it('rejects a duplicate edge (same from/to/type)', () => {
    const graph = new WorkGraph();
    graph.addNode(createTestWorkGraphNode({ nodeId: 'a' }));
    graph.addNode(createTestWorkGraphNode({ nodeId: 'b' }));
    graph.addEdge(createTestWorkGraphEdge({ edgeId: 'e1', fromNodeId: 'a', toNodeId: 'b', type: 'blocks' }));
    expect(() =>
      graph.addEdge(createTestWorkGraphEdge({ edgeId: 'e2', fromNodeId: 'a', toNodeId: 'b', type: 'blocks' })),
    ).toThrow(OrchestrationError);
  });

  it('rejects an edge across two different projects', () => {
    const graph = new WorkGraph();
    graph.addNode(createTestWorkGraphNode({ nodeId: 'a', projectId: 'proj-1' }));
    graph.addNode(createTestWorkGraphNode({ nodeId: 'b', projectId: 'proj-2' }));
    expect(() =>
      graph.addEdge(
        createTestWorkGraphEdge({ edgeId: 'e1', projectId: 'proj-1', fromNodeId: 'a', toNodeId: 'b' }),
      ),
    ).toThrow(OrchestrationError);
  });

  it('rejects an edge referencing an unknown node', () => {
    const graph = new WorkGraph();
    graph.addNode(createTestWorkGraphNode({ nodeId: 'a' }));
    expect(() =>
      graph.addEdge(createTestWorkGraphEdge({ edgeId: 'e1', fromNodeId: 'a', toNodeId: 'missing' })),
    ).toThrow(OrchestrationError);
  });

  it('rejects a direct cycle (A blocks B, B blocks A)', () => {
    const graph = new WorkGraph();
    graph.addNode(createTestWorkGraphNode({ nodeId: 'a' }));
    graph.addNode(createTestWorkGraphNode({ nodeId: 'b' }));
    graph.addEdge(createTestWorkGraphEdge({ edgeId: 'e1', fromNodeId: 'a', toNodeId: 'b', type: 'blocks' }));
    expect(() =>
      graph.addEdge(createTestWorkGraphEdge({ edgeId: 'e2', fromNodeId: 'b', toNodeId: 'a', type: 'blocks' })),
    ).toThrow(OrchestrationError);
  });

  it('rejects a transitive cycle across three nodes', () => {
    const graph = new WorkGraph();
    for (const id of ['a', 'b', 'c']) graph.addNode(createTestWorkGraphNode({ nodeId: id }));
    graph.addEdge(createTestWorkGraphEdge({ edgeId: 'e1', fromNodeId: 'a', toNodeId: 'b', type: 'blocks' }));
    graph.addEdge(createTestWorkGraphEdge({ edgeId: 'e2', fromNodeId: 'b', toNodeId: 'c', type: 'blocks' }));
    expect(() =>
      graph.addEdge(createTestWorkGraphEdge({ edgeId: 'e3', fromNodeId: 'c', toNodeId: 'a', type: 'blocks' })),
    ).toThrow(OrchestrationError);
  });

  it('rejects a cycle formed by mixing blocks and requires', () => {
    const graph = new WorkGraph();
    graph.addNode(createTestWorkGraphNode({ nodeId: 'a' }));
    graph.addNode(createTestWorkGraphNode({ nodeId: 'b' }));
    // a blocks b => a before b
    graph.addEdge(createTestWorkGraphEdge({ edgeId: 'e1', fromNodeId: 'a', toNodeId: 'b', type: 'blocks' }));
    // a requires b => b before a — directly contradicts a-before-b, i.e. a 2-cycle
    expect(() =>
      graph.addEdge(createTestWorkGraphEdge({ edgeId: 'e2', fromNodeId: 'a', toNodeId: 'b', type: 'requires' })),
    ).toThrow(OrchestrationError);
  });

  it('a node with no predecessors becomes Ready on construction', () => {
    const graph = new WorkGraph([createTestWorkGraphNode({ nodeId: 'a', status: 'Planned' })]);
    graph.recomputeReadiness('proj-1');
    expect(graph.getNode('a')?.status).toBe('Ready');
  });

  it('a node stays Blocked until its blocking predecessor is Accepted', () => {
    const graph = new WorkGraph(
      [
        createTestWorkGraphNode({ nodeId: 'a', status: 'Planned' }),
        createTestWorkGraphNode({ nodeId: 'b', status: 'Planned' }),
      ],
      [createTestWorkGraphEdge({ edgeId: 'e1', fromNodeId: 'a', toNodeId: 'b', type: 'blocks' })],
    );
    graph.recomputeReadiness('proj-1');
    expect(graph.getNode('a')?.status).toBe('Ready');
    expect(graph.getNode('b')?.status).toBe('Blocked');

    graph.setNodeStatus('a', 'InProgress');
    graph.setNodeStatus('a', 'Review');
    graph.setNodeStatus('a', 'Accepted');
    expect(graph.getNode('b')?.status).toBe('Ready');
  });

  it('a `requires` edge blocks the requiring node until the required node is Accepted', () => {
    const graph = new WorkGraph(
      [
        createTestWorkGraphNode({ nodeId: 'impl', status: 'Planned' }),
        createTestWorkGraphNode({ nodeId: 'arch', status: 'Planned' }),
      ],
      // impl requires arch => arch must be Accepted before impl is Ready
      [createTestWorkGraphEdge({ edgeId: 'e1', fromNodeId: 'impl', toNodeId: 'arch', type: 'requires' })],
    );
    graph.recomputeReadiness('proj-1');
    expect(graph.getNode('arch')?.status).toBe('Ready');
    expect(graph.getNode('impl')?.status).toBe('Blocked');
  });

  it('listReadyNodes excludes Ready nodes that already have a Work Package attached', () => {
    const graph = new WorkGraph([createTestWorkGraphNode({ nodeId: 'a', status: 'Planned' })]);
    graph.recomputeReadiness('proj-1');
    expect(graph.listReadyNodes('proj-1').map((n) => n.nodeId)).toEqual(['a']);

    graph.attachWorkPackage('a', 'wp-1');
    expect(graph.listReadyNodes('proj-1')).toEqual([]);
  });

  it('rejects an illegal node status transition', () => {
    const graph = new WorkGraph([createTestWorkGraphNode({ nodeId: 'a', status: 'Planned' })]);
    expect(() => graph.setNodeStatus('a', 'Accepted')).toThrow(OrchestrationError);
  });

  it('findNodeByWorkPackage resolves a node from its attached Work Package id', () => {
    const graph = new WorkGraph([createTestWorkGraphNode({ nodeId: 'a', status: 'Ready' })]);
    graph.attachWorkPackage('a', 'wp-42');
    expect(graph.findNodeByWorkPackage('wp-42')?.nodeId).toBe('a');
    expect(graph.findNodeByWorkPackage('wp-missing')).toBeUndefined();
  });
});
