import type { WorkGraphEdgeContract, WorkGraphNodeContract, WorkGraphNodeStatus } from '@umer/contracts';
import { OrchestrationError } from './errors.js';

/** Legal Work Graph node transitions — mirrors work-package state-machine.ts's shape at node granularity. */
const NODE_TRANSITIONS: Record<WorkGraphNodeStatus, readonly WorkGraphNodeStatus[]> = {
  Planned: ['Ready', 'Blocked', 'Cancelled'],
  Ready: ['Blocked', 'InProgress', 'Cancelled'],
  Blocked: ['Ready', 'Cancelled'],
  InProgress: ['Review', 'Failed', 'Cancelled'],
  Review: ['Accepted', 'Failed', 'Cancelled'],
  Accepted: [],
  Failed: ['Ready', 'Blocked', 'Cancelled'],
  Cancelled: [],
};

export function canTransitionNode(from: WorkGraphNodeStatus, to: WorkGraphNodeStatus): boolean {
  return NODE_TRANSITIONS[from].includes(to);
}

/**
 * In-process dependency graph for one Project's delivery decomposition
 * (Requirements → Product → Architecture → UX → Implementation → QA →
 * Security → Release → Operations — see @umer/contracts' work-graph domain).
 *
 * One instance = one project's graph: node/edge ids only need to be unique
 * within the instance, and every real caller constructs one via
 * PersistentWorkGraph.load(projectId) (work-graph-store.ts), which loads
 * exactly that project's rows. Cross-project id collisions are guarded at
 * the store layer (WorkGraphStore keys persisted rows by `${projectId}:${id}`),
 * not here — do not feed nodes from more than one project into a single
 * WorkGraph instance.
 *
 * This is pure in-memory graph logic — WorkGraphStore (work-graph-store.ts)
 * owns making it durable.
 */
export class WorkGraph {
  private readonly nodes = new Map<string, WorkGraphNodeContract>();
  private readonly edges = new Map<string, WorkGraphEdgeContract>();

  constructor(nodes: readonly WorkGraphNodeContract[] = [], edges: readonly WorkGraphEdgeContract[] = []) {
    for (const node of nodes) this.addNode(node);
    for (const edge of edges) this.addEdge(edge);
  }

  addNode(node: WorkGraphNodeContract): void {
    if (this.nodes.has(node.nodeId)) {
      throw new OrchestrationError('DUPLICATE_NODE', `Work Graph node already exists: ${node.nodeId}`);
    }
    this.nodes.set(node.nodeId, structuredClone(node));
  }

  addEdge(edge: WorkGraphEdgeContract): void {
    if (this.edges.has(edge.edgeId)) {
      throw new OrchestrationError('DUPLICATE_EDGE', `Work Graph edge already exists: ${edge.edgeId}`);
    }
    const from = this.requireNode(edge.fromNodeId);
    const to = this.requireNode(edge.toNodeId);
    if (from.projectId !== edge.projectId || to.projectId !== edge.projectId) {
      throw new OrchestrationError(
        'PROJECT_MISMATCH',
        `Edge ${edge.edgeId} references nodes outside project ${edge.projectId}`,
      );
    }
    const duplicate = [...this.edges.values()].some(
      (existing) =>
        existing.fromNodeId === edge.fromNodeId &&
        existing.toNodeId === edge.toNodeId &&
        existing.type === edge.type,
    );
    if (duplicate) {
      throw new OrchestrationError(
        'DUPLICATE_EDGE',
        `Edge ${edge.fromNodeId} -${edge.type}-> ${edge.toNodeId} already exists`,
      );
    }

    const [beforeId, afterId] = edge.type === 'blocks' ? [edge.fromNodeId, edge.toNodeId] : [edge.toNodeId, edge.fromNodeId];
    if (this.hasPath(afterId, beforeId)) {
      throw new OrchestrationError(
        'CYCLE_DETECTED',
        `Adding edge ${edge.edgeId} would create a cycle (${afterId} already precedes ${beforeId})`,
      );
    }

    this.edges.set(edge.edgeId, structuredClone(edge));
  }

  getNode(nodeId: string): WorkGraphNodeContract | undefined {
    const node = this.nodes.get(nodeId);
    return node ? structuredClone(node) : undefined;
  }

  listNodes(projectId?: string): WorkGraphNodeContract[] {
    const all = [...this.nodes.values()];
    return structuredClone(projectId ? all.filter((n) => n.projectId === projectId) : all);
  }

  listEdges(projectId?: string): WorkGraphEdgeContract[] {
    const all = [...this.edges.values()];
    return structuredClone(projectId ? all.filter((e) => e.projectId === projectId) : all);
  }

  /**
   * Nodes whose predecessors (per `beforeId` in addEdge's precedence sense)
   * are ALL Accepted. Used by recomputeReadiness — not itself a public
   * planning API (see listReadyNodes for that).
   */
  private predecessorsOf(nodeId: string): string[] {
    const predecessors: string[] = [];
    for (const edge of this.edges.values()) {
      if (edge.type === 'blocks' && edge.toNodeId === nodeId) predecessors.push(edge.fromNodeId);
      if (edge.type === 'requires' && edge.fromNodeId === nodeId) predecessors.push(edge.toNodeId);
    }
    return predecessors;
  }

  /** DFS: is there a directed precedence path from `startId` to `targetId`? */
  private hasPath(startId: string, targetId: string): boolean {
    if (startId === targetId) return true;
    const visited = new Set<string>();
    const stack = [startId];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === targetId) return true;
      if (visited.has(current)) continue;
      visited.add(current);
      for (const edge of this.edges.values()) {
        const [before, after] = edge.type === 'blocks' ? [edge.fromNodeId, edge.toNodeId] : [edge.toNodeId, edge.fromNodeId];
        if (before === current) stack.push(after);
      }
    }
    return false;
  }

  /**
   * Recomputes Planned/Blocked/Ready for every not-yet-dispatched node in a
   * project: Ready when every precedence predecessor is Accepted, Blocked
   * otherwise. Leaves InProgress/Review/Accepted/Failed/Cancelled nodes
   * alone — call this after any status change so downstream nodes can
   * unblock, and after graph construction so nodes with no predecessors
   * start Ready.
   */
  recomputeReadiness(projectId: string): void {
    for (const node of this.nodes.values()) {
      if (node.projectId !== projectId) continue;
      if (node.status !== 'Planned' && node.status !== 'Blocked' && node.status !== 'Ready') continue;

      const predecessors = this.predecessorsOf(node.nodeId);
      const allAccepted = predecessors.every((id) => this.nodes.get(id)?.status === 'Accepted');
      const nextStatus: WorkGraphNodeStatus = allAccepted ? 'Ready' : 'Blocked';
      if (node.status !== nextStatus) {
        this.setNodeStatus(node.nodeId, nextStatus, { skipRecompute: true });
      }
    }
  }

  /** Ready nodes with no Work Package attached yet — what the planner should act on. */
  listReadyNodes(projectId: string): WorkGraphNodeContract[] {
    return this.listNodes(projectId).filter((n) => n.status === 'Ready' && !n.workPackageId);
  }

  setNodeStatus(
    nodeId: string,
    status: WorkGraphNodeStatus,
    options: { skipRecompute?: boolean; at?: string } = {},
  ): WorkGraphNodeContract {
    const node = this.requireNode(nodeId);
    if (node.status !== status && !canTransitionNode(node.status, status)) {
      throw new OrchestrationError(
        'INVALID_NODE_TRANSITION',
        `Illegal Work Graph node transition: ${node.status} → ${status} (${nodeId})`,
      );
    }
    const updated: WorkGraphNodeContract = {
      ...node,
      status,
      updatedAt: options.at ?? new Date().toISOString(),
    };
    this.nodes.set(nodeId, updated);
    if (!options.skipRecompute) {
      this.recomputeReadiness(node.projectId);
    }
    return structuredClone(updated);
  }

  attachWorkPackage(nodeId: string, workPackageId: string, at?: string): WorkGraphNodeContract {
    const node = this.requireNode(nodeId);
    const updated: WorkGraphNodeContract = {
      ...node,
      workPackageId: workPackageId as WorkGraphNodeContract['workPackageId'],
      updatedAt: at ?? new Date().toISOString(),
    };
    this.nodes.set(nodeId, updated);
    return structuredClone(updated);
  }

  findNodeByWorkPackage(workPackageId: string): WorkGraphNodeContract | undefined {
    const node = [...this.nodes.values()].find((n) => n.workPackageId === workPackageId);
    return node ? structuredClone(node) : undefined;
  }

  private requireNode(nodeId: string): WorkGraphNodeContract {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new OrchestrationError('NODE_NOT_FOUND', `Work Graph node not found: ${nodeId}`);
    }
    return node;
  }
}
