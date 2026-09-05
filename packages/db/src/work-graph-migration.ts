import type { MySqlMigration } from './migrations.js';

/** Work Graph — Project delivery decomposition (Requirements/Product/Architecture/.../Operations nodes + blocks/requires edges). */
export const WORK_GRAPH_MIGRATIONS: readonly MySqlMigration[] = [
  {
    id: '011_work_graph',
    checksum: '3f1a8c6e4b2d9f70a5c3e8b1d6f4a2c9e7b5d3f1a8c6e4b2d9f70a5c3e8b1d6f',
    statements: [
      `CREATE TABLE IF NOT EXISTS work_graph_nodes (
        header_id VARCHAR(191) NOT NULL,
        project_id VARCHAR(191) NOT NULL,
        node_id VARCHAR(191) NOT NULL,
        type VARCHAR(32) NOT NULL,
        status VARCHAR(32) NOT NULL,
        title VARCHAR(500) NOT NULL,
        work_package_id VARCHAR(191) NULL,
        metadata_json JSON NOT NULL,
        created_at DATETIME(3) NOT NULL,
        updated_at DATETIME(3) NOT NULL,
        PRIMARY KEY (project_id, node_id),
        INDEX idx_work_graph_nodes_project_status (project_id, status),
        INDEX idx_work_graph_nodes_work_package (work_package_id)
      )`,
      `CREATE TABLE IF NOT EXISTS work_graph_edges (
        header_id VARCHAR(191) NOT NULL,
        project_id VARCHAR(191) NOT NULL,
        edge_id VARCHAR(191) NOT NULL,
        from_node_id VARCHAR(191) NOT NULL,
        to_node_id VARCHAR(191) NOT NULL,
        type VARCHAR(16) NOT NULL,
        metadata_json JSON NOT NULL,
        created_at DATETIME(3) NOT NULL,
        updated_at DATETIME(3) NOT NULL,
        PRIMARY KEY (project_id, edge_id),
        INDEX idx_work_graph_edges_project (project_id)
      )`,
    ],
  },
];
