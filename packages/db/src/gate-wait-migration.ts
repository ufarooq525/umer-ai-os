import type { MySqlMigration } from './migrations.js';

/** Control Plane Gate Wait records — CEO's "needs your attention" review queue (@umer/control-plane). */
export const GATE_WAIT_MIGRATIONS: readonly MySqlMigration[] = [
  {
    id: '012_control_plane_gate_waits',
    checksum: '7c2e9a4f1d6b8c3e0a5f2d9c7b4e1a8f6d3c0b9e7a4f1d6b8c3e0a5f2d9c7b4e',
    statements: [
      `CREATE TABLE IF NOT EXISTS control_plane_gate_waits (
        wait_id VARCHAR(191) PRIMARY KEY,
        gate_id VARCHAR(191) NOT NULL,
        exec_id VARCHAR(191) NOT NULL,
        work_package_id VARCHAR(191) NOT NULL,
        artifact_id VARCHAR(191) NULL,
        stage_from VARCHAR(191) NOT NULL,
        stage_to VARCHAR(191) NOT NULL,
        status VARCHAR(16) NOT NULL,
        required_approvers_json JSON NOT NULL,
        recorded_approvers_json JSON NOT NULL,
        human_required TINYINT(1) NOT NULL,
        requested_at DATETIME(3) NOT NULL,
        resolved_at DATETIME(3) NULL,
        rationale TEXT NULL,
        INDEX idx_gate_waits_status (status, requested_at),
        INDEX idx_gate_waits_work_package (work_package_id),
        INDEX idx_gate_waits_gate (gate_id)
      )`,
    ],
  },
];
