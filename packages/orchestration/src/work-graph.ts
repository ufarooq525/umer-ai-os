import { WorkGraphEdgeSchema, WorkGraphNodeSchema, type WorkGraphEdge, type WorkGraphNode } from '@umer/contracts';

export class WorkGraphError extends Error {
  constructor(
    public readonly code: 'NODE_EXISTS' | 'NODE_NOT_FOUND' | 'EDGE_EXISTS' | 'CYCLE' | 'PROJECT_MISMATCH',
    message: string,
  ) {
    super(message);
    this.name = 'WorkGraphError';
  }
}

/**
 * Deterministic dependency engine for the company delivery graph.
 * Persistence is intentionally separated so the same semantics can be backed
 * by MySQL without creating a second orchestration model.
 */
export class WorkGraph {
  private readonly nodes = new Map<string, WorkGraphNode>();
  private readonly edges = new Map<string, WorkGraphEdge>();

  addNode(input: WorkGraphNode): WorkGraphNode {
    const node = WorkGraphNodeSchema.parse(input);
    if (this.nodes.has(node.nodeId)) throw new WorkGraphError('NODE_EXISTS', `Work Graph node already exists: ${node.nodeId}`);
    this.nodes.set(node.nodeId, node);
    return node;
  }

  addEdge(input: WorkGraphEdge): WorkGraphEdge {
    const edge = WorkGraphEdgeSchema.parse(input);
    const from = this.requireNode(edge.fromNodeId);
    const to = this.requireNode(edge.toNodeId);
    if (from.projectId !== edge.projectId || to.projectId !== edge.projectId) {
      throw new WorkGraphError('PROJECT_MISMATCH', `Work Graph edge ${edge.edgeId} crosses project boundaries`);
    }
    if (this.edges.has(edge.edgeId) || [...this.edges.values()].some((e) => e.fromNodeId === edge.fromNodeId && e.toNodeId === edge.toNodeId && e.dependencyType === edge.dependencyType)) {
      throw new WorkGraphError('EDGE_EXISTS', `Work Graph edge already exists: ${edge.edgeId}`);
    }
    if (this.wouldCycle(edge.fromNodeId, edge.toNodeId)) {
      throw new WorkGraphError('CYCLE', `Work Graph dependency would create a cycle: ${edge.fromNodeId} -> ${edge.toNodeId}`);
    }
    this.edges.set(edge.edgeId, edge);
    return edge;
  }

  getNode(nodeId: string): WorkGraphNode {
    return this.requireNode(nodeId);
  }

  listNodes(projectId?: string): WorkGraphNode[] {
    return [...this.nodes.values()].filter((node) => !projectId || node.projectId === projectId);
  }

  listEdges(projectId?: string): WorkGraphEdge[] {
    return [...this.edges.values()].filter((edge) => !projectId || edge.projectId === projectId);
  }

  blockers(nodeId: string): WorkGraphNode[] {
    this.requireNode(nodeId);
    return this.listEdges().filter((edge) => edge.toNodeId === nodeId && edge.dependencyType === 'blocks').map((edge) => this.requireNode(edge.fromNodeId)).filter((node) => node.status !== 'Accepted');
  }

  isReady(nodeId: string): boolean {
    const node = this.requireNode(nodeId);
    if (node.status !== 'Planned' && node.status !== 'Ready') return false;
    return this.blockers(node.nodeId).length === 0;
  }

  readyNodes(projectId?: string): WorkGraphNode[] {
    return this.listNodes(projectId).filter((node) => this.isReady(node.nodeId));
  }

  setStatus(nodeId: string, status: WorkGraphNode['status'], now: string): WorkGraphNode {
    const node = this.requireNode(nodeId);
    const updated = WorkGraphNodeSchema.parse({ ...node, status, updatedAt: now });
    this.nodes.set(nodeId, updated);
    return updated;
  }

  attachWorkPackage(nodeId: string, workPackageId: string, now: string): WorkGraphNode {
    const node = this.requireNode(nodeId);
    const updated = WorkGraphNodeSchema.parse({ ...node, workPackageId, status: 'Ready', updatedAt: now });
    this.nodes.set(nodeId, updated);
    return updated;
  }

  private requireNode(nodeId: string): WorkGraphNode {
    const node = this.nodes.get(nodeId);
    if (!node) throw new WorkGraphError('NODE_NOT_FOUND', `Work Graph node not found: ${nodeId}`);
    return node;
  }

  private wouldCycle(fromNodeId: string, toNodeId: string): boolean {
    const visited = new Set<string>();
    const visit = (nodeId: string): boolean => {
      if (nodeId === fromNodeId) return true;
      if (visited.has(nodeId)) return false;
      visited.add(nodeId);
      return this.listEdges().filter((edge) => edge.fromNodeId === nodeId).some((edge) => visit(edge.toNodeId));
    };
    return visit(toNodeId);
  }
}

export function createWorkGraph(nodes: readonly WorkGraphNode[] = [], edges: readonly WorkGraphEdge[] = []): WorkGraph {
  const graph = new WorkGraph();
  for (const node of nodes) graph.addNode(node);
  for (const edge of edges) graph.addEdge(edge);
  return graph;
}
