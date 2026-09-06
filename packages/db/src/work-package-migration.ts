import type { MySqlMigration } from './migrations.js';

/** Orchestrator's own Work Package records — the authoritative Work Package store (@umer/orchestration). */
export const WORK_PACKAGE_MIGRATIONS: readonly MySqlMigration[] = [
  {
    id: '013_orchestration_work_packages',
    checksum: '9d4f2a7c1e6b3d8f0a5c2e9d7b4f1a8c6e3d0b9f7a4c1e6b3d8f0a5c2e9d7b4f',
    statements: [
      `CREATE TABLE IF NOT EXISTS orchestration_work_packages (
        work_package_id VARCHAR(191) PRIMARY KEY,
        header_id VARCHAR(191) NOT NULL,
        exec_id VARCHAR(191) NOT NULL,
        stage VARCHAR(191) NOT NULL,
        status VARCHAR(32) NOT NULL,
        specialist_id VARCHAR(191) NOT NULL,
        specialist_spec_version VARCHAR(64) NOT NULL,
        specialist_spec_hash VARCHAR(191) NOT NULL,
        task_ids_json JSON NOT NULL,
        capability_ids_json JSON NOT NULL,
        context_handle VARCHAR(191) NOT NULL,
        tool_allowlist_json JSON NOT NULL,
        resource_envelope_json JSON NOT NULL,
        attempt INT UNSIGNED NOT NULL,
        parent_work_package_id VARCHAR(191) NULL,
        correlation_id VARCHAR(191) NULL,
        metadata_json JSON NOT NULL,
        created_at DATETIME(3) NOT NULL,
        updated_at DATETIME(3) NOT NULL,
        queued_at DATETIME(3) NULL,
        dispatched_at DATETIME(3) NULL,
        started_at DATETIME(3) NULL,
        last_error TEXT NULL,
        INDEX idx_work_packages_status (status),
        INDEX idx_work_packages_exec (exec_id)
      )`,
    ],
  },
];
