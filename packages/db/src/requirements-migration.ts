import type { MySqlMigration } from './migrations.js';

/** Canonical Requirements records — source of truth for client/product intake. */
export const REQUIREMENTS_MIGRATIONS: readonly MySqlMigration[] = [
  {
    id: '015_requirements',
    checksum: 'requirements-v1-20260907',
    statements: [
      `CREATE TABLE IF NOT EXISTS requirements (
        requirement_id VARCHAR(191) PRIMARY KEY,
        request_id VARCHAR(191) NULL,
        project_id VARCHAR(191) NULL,
        opportunity_id VARCHAR(191) NULL,
        customer_id VARCHAR(191) NULL,
        status VARCHAR(32) NOT NULL,
        title VARCHAR(500) NOT NULL,
        problem TEXT NOT NULL,
        desired_outcome TEXT NOT NULL,
        constraints_json JSON NOT NULL,
        acceptance_criteria_json JSON NOT NULL,
        assumptions_json JSON NOT NULL,
        open_questions_json JSON NOT NULL,
        source_kind VARCHAR(32) NOT NULL,
        source_id VARCHAR(191) NULL,
        source_label VARCHAR(500) NULL,
        decision_json JSON NULL,
        header_id VARCHAR(191) NOT NULL,
        created_at DATETIME(3) NOT NULL,
        updated_at DATETIME(3) NOT NULL,
        INDEX idx_requirements_project (project_id),
        INDEX idx_requirements_request (request_id),
        INDEX idx_requirements_opportunity (opportunity_id),
        INDEX idx_requirements_status (status)
      )`,
    ],
  },
];
