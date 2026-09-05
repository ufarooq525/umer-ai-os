import type { WorkGraphEdgeContract, WorkGraphNodeContract, WorkGraphNodeStatus } from '@umer/contracts';
import { WorkGraph } from './work-graph.js';

export type WorkGraphStore = {
  listNodes(projectId: string): Promise<WorkGraphNodeContract[]>;
  listEdges(projectId: string): Promise<WorkGraphEdgeContract[]>;
  saveNode(node: WorkGraphNodeContract): Promise<void>;
  saveEdge(edge: WorkGraphEdgeContract): Promise<void>;
  /**
   * Which project's graph owns the node a given Work Package was created
   * for, if any — Work Package contracts carry no projectId of their own
   * (see @umer/contracts' work-packages domain), so WorkGraphProjector needs
   * this reverse lookup to know which project's graph to load when an
   * `agent.run.*`/orchestration lifecycle event only names a workPackageId.
   * Undefined for a Work Package that didn't originate from a Work Graph
   * node (e.g. the separate audit-pipeline intake flow) — the projector
   * treats that as "nothing to project", not an error.
   */
  findProjectIdByWorkPackage(workPackageId: string): Promise<string | undefined>;
};

export class InMemoryWorkGraphStore implements WorkGraphStore {
  // Keyed by `${projectId}:${nodeId|edgeId}` — node/edge ids are only
  // required to be unique within their own project's graph (e.g. two
  // projects both naming their Architecture node "architecture"), so a bare
  // id would let one project's save silently clobber another's.
  private readonly nodes = new Map<string, WorkGraphNodeContract>();
  private readonly edges = new Map<string, WorkGraphEdgeContract>();

  async listNodes(projectId: string): Promise<WorkGraphNodeContract[]> {
    return structuredClone([...this.nodes.values()].filter((n) => n.projectId === projectId));
  }

  async listEdges(projectId: string): Promise<WorkGraphEdgeContract[]> {
    return structuredClone([...this.edges.values()].filter((e) => e.projectId === projectId));
  }

  async saveNode(node: WorkGraphNodeContract): Promise<void> {
    this.nodes.set(`${node.projectId}:${node.nodeId}`, structuredClone(node));
  }

  async saveEdge(edge: WorkGraphEdgeContract): Promise<void> {
    this.edges.set(`${edge.projectId}:${edge.edgeId}`, structuredClone(edge));
  }

  async findProjectIdByWorkPackage(workPackageId: string): Promise<string | undefined> {
    return [...this.nodes.values()].find((n) => n.workPackageId === workPackageId)?.projectId;
  }

  clear(): void {
    this.nodes.clear();
    this.edges.clear();
  }
}

/**
 * Loads a Project's Work Graph from a WorkGraphStore, and persists back only
 * the nodes/edges a mutation actually changed (recomputeReadiness can
 * cascade a single Accepted node into several downstream nodes flipping
 * Blocked → Ready in one call — this diffs before/after so every changed
 * node gets saved, not just the one the caller named).
 */
export class PersistentWorkGraph {
  constructor(private readonly store: WorkGraphStore) {}

  async load(projectId: string): Promise<WorkGraph> {
    const [nodes, edges] = await Promise.all([
      this.store.listNodes(projectId),
      this.store.listEdges(projectId),
    ]);
    const graph = new WorkGraph(nodes, edges);
    const before = new Map(nodes.map((n) => [n.nodeId, n.status]));
    graph.recomputeReadiness(projectId);
    // recomputeReadiness only mutates the in-memory graph — persist any
    // Planned/Blocked/Ready flips it made (e.g. a node saved as Planned with
    // no predecessors, or a predecessor that finished Accepted since the
    // last write) so the store never lags behind what a fresh load computes.
    await this.persistChanged(graph, projectId, before);
    return graph;
  }

  async addNode(graph: WorkGraph, node: WorkGraphNodeContract): Promise<void> {
    graph.addNode(node);
    graph.recomputeReadiness(node.projectId);
    await this.persistProject(graph, node.projectId);
  }

  async addEdge(graph: WorkGraph, edge: WorkGraphEdgeContract): Promise<void> {
    graph.addEdge(edge);
    await this.store.saveEdge(edge);
    graph.recomputeReadiness(edge.projectId);
    await this.persistProject(graph, edge.projectId);
  }

  async setNodeStatus(
    graph: WorkGraph,
    projectId: string,
    nodeId: string,
    status: WorkGraphNodeStatus,
  ): Promise<WorkGraphNodeContract[]> {
    const before = new Map(graph.listNodes(projectId).map((n) => [n.nodeId, n.status]));
    graph.setNodeStatus(nodeId, status);
    return this.persistChanged(graph, projectId, before);
  }

  async attachWorkPackage(
    graph: WorkGraph,
    projectId: string,
    nodeId: string,
    workPackageId: string,
  ): Promise<WorkGraphNodeContract> {
    const updated = graph.attachWorkPackage(nodeId, workPackageId);
    if (updated.projectId !== projectId) {
      throw new Error(`Node ${nodeId} belongs to project ${updated.projectId}, not ${projectId}`);
    }
    await this.store.saveNode(updated);
    return updated;
  }

  private async persistProject(graph: WorkGraph, projectId: string): Promise<void> {
    await Promise.all(graph.listNodes(projectId).map((n) => this.store.saveNode(n)));
  }

  private async persistChanged(
    graph: WorkGraph,
    projectId: string,
    before: Map<string, WorkGraphNodeStatus>,
  ): Promise<WorkGraphNodeContract[]> {
    const after = graph.listNodes(projectId);
    const changed = after.filter((n) => before.get(n.nodeId) !== n.status);
    await Promise.all(changed.map((n) => this.store.saveNode(n)));
    return changed;
  }
}
