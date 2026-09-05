import { describe, expect, it } from 'vitest';
import { WorkGraph, WorkGraphError } from './work-graph.js';
import type { WorkGraphEdge, WorkGraphNode } from '@umer/contracts';

const node = (id: string, status: WorkGraphNode['status'] = 'Planned'): WorkGraphNode => ({
  nodeId: id,
  projectId: 'project-1',
  type: 'Implementation',
  title: id,
  status,
  requiredCapabilityIds: [],
  metadata: {},
  createdAt: '2026-09-05T12:00:00.000Z',
  updatedAt: '2026-09-05T12:00:00.000Z',
});

const edge = (id: string, fromNodeId: string, toNodeId: string): WorkGraphEdge => ({
  edgeId: id,
  projectId: 'project-1',
  fromNodeId,
  toNodeId,
  dependencyType: 'blocks',
  createdAt: '2026-09-05T12:00:00.000Z',
});

describe('WorkGraph', () => {
  it('returns only unblocked nodes as ready', () => {
    const graph = new WorkGraph();
    graph.addNode(node('requirements', 'Accepted'));
    graph.addNode(node('implementation'));
    graph.addEdge(edge('e1', 'requirements', 'implementation'));
    expect(graph.readyNodes('project-1').map((item) => item.nodeId)).toEqual(['implementation']);
  });

  it('blocks a node until its dependency is accepted', () => {
    const graph = new WorkGraph();
    graph.addNode(node('requirements'));
    graph.addNode(node('implementation'));
    graph.addEdge(edge('e1', 'requirements', 'implementation'));
    expect(graph.isReady('implementation')).toBe(false);
    graph.setStatus('requirements', 'Accepted', '2026-09-05T13:00:00.000Z');
    expect(graph.isReady('implementation')).toBe(true);
  });

  it('rejects cycles', () => {
    const graph = new WorkGraph();
    graph.addNode(node('a'));
    graph.addNode(node('b'));
    graph.addEdge(edge('e1', 'a', 'b'));
    expect(() => graph.addEdge(edge('e2', 'b', 'a'))).toThrowError(WorkGraphError);
  });
});
