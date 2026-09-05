import {
  WorkGraphEdgeSchema,
  WorkGraphNodeSchema,
  type WorkGraphEdge,
  type WorkGraphNode,
} from '@umer/contracts';
import type { MySqlExecutor } from './index.js';

export type WorkGraphStore = {
  getNode(nodeId: string): Promise<WorkGraphNode | undefined>;
  listNodes(projectId: string): Promise<WorkGraphNode[]>;
  listEdges(projectId: string): Promise<WorkGraphEdge[]>;
  saveNode(node: WorkGraphNode): Promise<void>;
  saveEdge(edge: WorkGraphEdge): Promise<void>;
  setNodeStatus(nodeId: string, status: WorkGraphNode['status'], updatedAt: string): Promise<void>;
  attachWorkPackage(nodeId: string, workPackageId: string, updatedAt: string): Promise<void>;
};

type NodeRow = {
  node_id: string;
  project_id: string;
  node_type: WorkGraphNode['type'];
  title: string;
  status: WorkGraphNode['status'];
  work_package_id: string | null;
  required_capabilities_json: string;
  metadata_json: string;
  created_at: string;
  updated_at: string;
};

type EdgeRow = {
  edge_id: string;
  project_id: string;
  from_node_id: string;
  to_node_id: string;
  dependency_type: WorkGraphEdge['dependencyType'];
  created_at: string;
};

function parseJson(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  const parsed: unknown = JSON.parse(value);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : {};
}

function nodeFromRow(row: NodeRow): WorkGraphNode {
  return WorkGraphNodeSchema.parse({
    nodeId: row.node_id,
    projectId: row.project_id,
    type: row.node_type,
    title: row.title,
    status: row.status,
    ...(row.work_package_id ? { workPackageId: row.work_package_id } : {}),
    requiredCapabilityIds: JSON.parse(row.required_capabilities_json),
    metadata: parseJson(row.metadata_json),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  });
}

function edgeFromRow(row: EdgeRow): WorkGraphEdge {
  return WorkGraphEdgeSchema.parse({
    edgeId: row.edge_id,
    projectId: row.project_id,
    fromNodeId: row.from_node_id,
    toNodeId: row.to_node_id,
    dependencyType: row.dependency_type,
    createdAt: new Date(row.created_at).toISOString(),
  });
}

export class MySqlWorkGraphStore implements WorkGraphStore {
  constructor(private readonly executor: MySqlExecutor) {}

  async getNode(nodeId: string): Promise<WorkGraphNode | undefined> {
    const rows = await this.executor.execute<NodeRow[]>(
      `SELECT node_id, project_id, node_type, title, status, work_package_id,
              required_capabilities_json, metadata_json, created_at, updated_at
         FROM work_graph_nodes WHERE node_id = ? LIMIT 1`,
      [nodeId],
    );
    return rows[0] ? nodeFromRow(rows[0]) : undefined;
  }

  async listNodes(projectId: string): Promise<WorkGraphNode[]> {
    const rows = await this.executor.execute<NodeRow[]>(
      `SELECT node_id, project_id, node_type, title, status, work_package_id,
              required_capabilities_json, metadata_json, created_at, updated_at
         FROM work_graph_nodes WHERE project_id = ? ORDER BY created_at ASC`,
      [projectId],
    );
    return rows.map(nodeFromRow);
  }

  async listEdges(projectId: string): Promise<WorkGraphEdge[]> {
    const rows = await this.executor.execute<EdgeRow[]>(
      `SELECT edge_id, project_id, from_node_id, to_node_id, dependency_type, created_at
         FROM work_graph_edges WHERE project_id = ? ORDER BY created_at ASC`,
      [projectId],
    );
    return rows.map(edgeFromRow);
  }

  async saveNode(node: WorkGraphNode): Promise<void> {
    const value = WorkGraphNodeSchema.parse(node);
    await this.executor.execute(
      `INSERT INTO work_graph_nodes
        (node_id, project_id, node_type, title, status, work_package_id,
         required_capabilities_json, metadata_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         project_id = VALUES(project_id), node_type = VALUES(node_type),
         title = VALUES(title), status = VALUES(status),
         work_package_id = VALUES(work_package_id),
         required_capabilities_json = VALUES(required_capabilities_json),
         metadata_json = VALUES(metadata_json), updated_at = VALUES(updated_at)`,
      [
        value.nodeId,
        value.projectId,
        value.type,
        value.title,
        value.status,
        value.workPackageId ?? null,
        JSON.stringify(value.requiredCapabilityIds),
        JSON.stringify(value.metadata),
        value.createdAt,
        value.updatedAt,
      ],
    );
  }

  async saveEdge(edge: WorkGraphEdge): Promise<void> {
    const value = WorkGraphEdgeSchema.parse(edge);
    await this.executor.execute(
      `INSERT INTO work_graph_edges
        (edge_id, project_id, from_node_id, to_node_id, dependency_type, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         project_id = VALUES(project_id), from_node_id = VALUES(from_node_id),
         to_node_id = VALUES(to_node_id), dependency_type = VALUES(dependency_type)`,
      [value.edgeId, value.projectId, value.fromNodeId, value.toNodeId, value.dependencyType, value.createdAt],
    );
  }

  async setNodeStatus(nodeId: string, status: WorkGraphNode['status'], updatedAt: string): Promise<void> {
    await this.executor.execute(
      `UPDATE work_graph_nodes SET status = ?, updated_at = ? WHERE node_id = ?`,
      [status, updatedAt, nodeId],
    );
  }

  async attachWorkPackage(nodeId: string, workPackageId: string, updatedAt: string): Promise<void> {
    await this.executor.execute(
      `UPDATE work_graph_nodes SET work_package_id = ?, updated_at = ? WHERE node_id = ?`,
      [workPackageId, updatedAt, nodeId],
    );
  }
}
