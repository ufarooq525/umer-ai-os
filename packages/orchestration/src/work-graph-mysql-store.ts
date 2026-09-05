import { parseContract, SCHEMA_VERSION, WorkGraphEdgeContractSchema, WorkGraphNodeContractSchema } from '@umer/contracts';
import type { WorkGraphEdgeContract, WorkGraphNodeContract } from '@umer/contracts';
import type { WorkGraphStore } from './work-graph-store.js';

/**
 * MySQL adapter contract — intentionally injected (structural, not a driver
 * import) so this package never depends on a specific MySQL client. Matches
 * @umer/opportunity-intelligence's MySqlExecutor shape; a real caller wires
 * this to @umer/db's createMySqlExecutor().
 */
export type MySqlExecutor = {
  execute<T = unknown>(sql: string, params?: readonly unknown[]): Promise<T>;
};

export type MySqlWorkGraphStoreOptions = {
  db: MySqlExecutor;
};

type NodeRow = {
  header_id: string;
  project_id: string;
  node_id: string;
  type: string;
  status: string;
  title: string;
  work_package_id: string | null;
  metadata_json: string | Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type EdgeRow = {
  header_id: string;
  project_id: string;
  edge_id: string;
  from_node_id: string;
  to_node_id: string;
  type: string;
  metadata_json: string | Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

function toIso(value: string | Date): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function toMySqlDateTime(iso: string): string {
  return new Date(iso).toISOString().slice(0, 23).replace('T', ' ');
}

function parseJsonColumn<T>(value: string | T): T {
  return typeof value === 'string' ? (JSON.parse(value) as T) : value;
}

function rowToNode(row: NodeRow): WorkGraphNodeContract {
  return parseContract(WorkGraphNodeContractSchema, {
    id: row.header_id,
    schemaVersion: SCHEMA_VERSION,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    metadata: parseJsonColumn(row.metadata_json),
    kind: 'work_graph_node',
    nodeId: row.node_id,
    projectId: row.project_id,
    type: row.type,
    status: row.status,
    title: row.title,
    ...(row.work_package_id ? { workPackageId: row.work_package_id } : {}),
  });
}

function rowToEdge(row: EdgeRow): WorkGraphEdgeContract {
  return parseContract(WorkGraphEdgeContractSchema, {
    id: row.header_id,
    schemaVersion: SCHEMA_VERSION,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    metadata: parseJsonColumn(row.metadata_json),
    kind: 'work_graph_edge',
    edgeId: row.edge_id,
    projectId: row.project_id,
    fromNodeId: row.from_node_id,
    toNodeId: row.to_node_id,
    type: row.type,
  });
}

/**
 * MySQL-backed WorkGraphStore — see packages/db's work-graph-migration.ts
 * for the `work_graph_nodes`/`work_graph_edges` schema. Every write is an
 * upsert keyed by (project_id, node_id|edge_id), matching how
 * PersistentWorkGraph calls saveNode/saveEdge (always with the full current
 * record, never a partial patch).
 */
export class MySqlWorkGraphStore implements WorkGraphStore {
  constructor(private readonly options: MySqlWorkGraphStoreOptions) {}

  async listNodes(projectId: string): Promise<WorkGraphNodeContract[]> {
    const rows = await this.options.db.execute<NodeRow[]>(
      'SELECT header_id, project_id, node_id, type, status, title, work_package_id, metadata_json, created_at, updated_at FROM work_graph_nodes WHERE project_id = ?',
      [projectId],
    );
    return rows.map(rowToNode);
  }

  async listEdges(projectId: string): Promise<WorkGraphEdgeContract[]> {
    const rows = await this.options.db.execute<EdgeRow[]>(
      'SELECT header_id, project_id, edge_id, from_node_id, to_node_id, type, metadata_json, created_at, updated_at FROM work_graph_edges WHERE project_id = ?',
      [projectId],
    );
    return rows.map(rowToEdge);
  }

  async saveNode(node: WorkGraphNodeContract): Promise<void> {
    await this.options.db.execute(
      `INSERT INTO work_graph_nodes (header_id, project_id, node_id, type, status, title, work_package_id, metadata_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE header_id=VALUES(header_id), type=VALUES(type), status=VALUES(status), title=VALUES(title), work_package_id=VALUES(work_package_id), metadata_json=VALUES(metadata_json), updated_at=VALUES(updated_at)`,
      [
        node.id,
        node.projectId,
        node.nodeId,
        node.type,
        node.status,
        node.title,
        node.workPackageId ?? null,
        JSON.stringify(node.metadata),
        toMySqlDateTime(node.createdAt),
        toMySqlDateTime(node.updatedAt),
      ],
    );
  }

  async saveEdge(edge: WorkGraphEdgeContract): Promise<void> {
    await this.options.db.execute(
      `INSERT INTO work_graph_edges (header_id, project_id, edge_id, from_node_id, to_node_id, type, metadata_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE header_id=VALUES(header_id), from_node_id=VALUES(from_node_id), to_node_id=VALUES(to_node_id), type=VALUES(type), metadata_json=VALUES(metadata_json), updated_at=VALUES(updated_at)`,
      [
        edge.id,
        edge.projectId,
        edge.edgeId,
        edge.fromNodeId,
        edge.toNodeId,
        edge.type,
        JSON.stringify(edge.metadata),
        toMySqlDateTime(edge.createdAt),
        toMySqlDateTime(edge.updatedAt),
      ],
    );
  }

  async findProjectIdByWorkPackage(workPackageId: string): Promise<string | undefined> {
    const rows = await this.options.db.execute<Array<{ project_id: string }>>(
      'SELECT project_id FROM work_graph_nodes WHERE work_package_id = ? LIMIT 1',
      [workPackageId],
    );
    return rows[0]?.project_id;
  }
}
