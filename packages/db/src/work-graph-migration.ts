import type { MySqlMigration } from './migrations.js';

/** Durable project work graph: nodes are business workflow stages, edges are real dependencies. */
export const WORK_GRAPH_MIGRATIONS: readonly MySqlMigration[] = [
  {
    id: '012_work_graph',
    checksum: '7f2c9a4e1b6d8f3a5c0e7b2d9a4f6c1e8b5d0a3f7c2e9b6d1a4f8c5e0b7d2a9',
    statements: [
      `CREATE TABLE IF NOT EXISTS work_graph_nodes (
        node_id VARCHAR(191) PRIMARY KEY,
        project_id VARCHAR(191) NOT NULL,
        node_type VARCHAR(32) NOT NULL,
        title VARCHAR(500) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'Planned',
        work_package_id VARCHAR(191) NULL,
        required_capabilities_json JSON NOT NULL,
        metadata_json JSON NOT NULL,
        created_at DATETIME(3) NOT NULL,
        updated_at DATETIME(3) NOT NULL,
        INDEX idx_work_graph_nodes_project_status (project_id, status),
        INDEX idx_work_graph_nodes_work_package (work_package_id)
      )`,
      `CREATE TABLE IF NOT EXISTS work_graph_edges (
        edge_id VARCHAR(191) PRIMARY KEY,
        project_id VARCHAR(191) NOT NULL,
        from_node_id VARCHAR(191) NOT NULL,
        to_node_id VARCHAR(191) NOT NULL,
        dependency_type VARCHAR(32) NOT NULL,
        created_at DATETIME(3) NOT NULL,
        UNIQUE KEY uq_work_graph_edge (from_node_id, to_node_id, dependency_type),
        INDEX idx_work_graph_edges_project (project_id),
        INDEX idx_work_graph_edges_to (to_node_id),
        INDEX idx_work_graph_edges_from (from_node_id)
      )`,
    ],
  },
];
