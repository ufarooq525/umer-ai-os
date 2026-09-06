import type { MySqlMigration } from './migrations.js';

/** Artifact Runtime records — the real produced-work artifacts (@umer/artifacts' ArtifactStore). */
export const ARTIFACT_MIGRATIONS: readonly MySqlMigration[] = [
  {
    id: '015_artifact_runtime_artifacts',
    checksum: '2b5e8a1d4f7c0b3e6a9d2c5f8b1e4a7d0c3f6b9e2a5d8c1f4b7e0a3d6c9f2b5e',
    statements: [
      `CREATE TABLE IF NOT EXISTS artifact_runtime_artifacts (
        artifact_id VARCHAR(191) PRIMARY KEY,
        header_id VARCHAR(191) NOT NULL,
        artifact_type VARCHAR(32) NOT NULL,
        version VARCHAR(191) NOT NULL,
        produced_by VARCHAR(191) NOT NULL,
        produced_for VARCHAR(191) NOT NULL,
        acceptance_status VARCHAR(16) NOT NULL,
        acceptance_criteria_met_json JSON NOT NULL,
        source_task_id VARCHAR(191) NULL,
        content_ref VARCHAR(2048) NOT NULL,
        content_hash VARCHAR(191) NULL,
        supersedes_artifact_id VARCHAR(191) NULL,
        metadata_json JSON NOT NULL,
        created_at DATETIME(3) NOT NULL,
        updated_at DATETIME(3) NOT NULL,
        INDEX idx_artifacts_produced_for (produced_for),
        INDEX idx_artifacts_type (artifact_type),
        INDEX idx_artifacts_source_task (source_task_id)
      )`,
    ],
  },
];
