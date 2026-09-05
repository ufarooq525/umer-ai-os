import {
  type WorkGraphEdge,
  type WorkGraphNode,
  type WorkGraphNodeStatus,
} from '@umer/contracts';
import { WorkGraph } from './work-graph.js';

export type WorkGraphPersistence = {
  getNode(nodeId: string): Promise<WorkGraphNode | undefined>;
  listNodes(projectId: string): Promise<WorkGraphNode[]>;
  listEdges(projectId: string): Promise<WorkGraphEdge[]>;
  saveNode(node: WorkGraphNode): Promise<void>;
  saveEdge(edge: WorkGraphEdge): Promise<void>;
  setNodeStatus(nodeId: string, status: WorkGraphNodeStatus, updatedAt: string): Promise<void>;
  attachWorkPackage(nodeId: string, workPackageId: string, updatedAt: string): Promise<void>;
};

/** Persistence-aware graph facade. The domain WorkGraph remains authoritative for dependency rules. */
export class PersistentWorkGraph {
  constructor(private readonly persistence: WorkGraphPersistence) {}

  async load(projectId: string): Promise<WorkGraph> {
    return new WorkGraph(
      await this.persistence.listNodes(projectId),
      await this.persistence.listEdges(projectId),
    );
  }

  async addNode(node: WorkGraphNode): Promise<WorkGraphNode> {
    const graph = await this.load(node.projectId);
    graph.addNode(node);
    await this.persistence.saveNode(node);
    return node;
  }

  async addEdge(edge: WorkGraphEdge): Promise<WorkGraphEdge> {
    const graph = await this.load(edge.projectId);
    graph.addEdge(edge);
    await this.persistence.saveEdge(edge);
    return edge;
  }

  async setStatus(nodeId: string, status: WorkGraphNodeStatus, updatedAt: string): Promise<void> {
    const node = await this.persistence.getNode(nodeId);
    if (!node) return;
    const graph = await this.load(node.projectId);
    graph.setStatus(nodeId, status, updatedAt);
    await this.persistence.setNodeStatus(nodeId, status, updatedAt);
  }

  async attachWorkPackage(nodeId: string, workPackageId: string, updatedAt: string): Promise<void> {
    const node = await this.persistence.getNode(nodeId);
    if (!node) return;
    const graph = await this.load(node.projectId);
    graph.attachWorkPackage(nodeId, workPackageId, updatedAt);
    await this.persistence.attachWorkPackage(nodeId, workPackageId, updatedAt);
  }
}

export const createPersistentWorkGraph = (
  persistence: WorkGraphPersistence,
): PersistentWorkGraph => new PersistentWorkGraph(persistence);
