import type { MySqlMigration } from './migrations.js';

/** Work Management Project + Task records — owned by apps/control-api (ProjectStore/TaskStore). */
export const WORK_MANAGEMENT_MIGRATIONS: readonly MySqlMigration[] = [
  {
    id: '014_work_management_projects_tasks',
    checksum: '5a8c1f4e7b0d3a6c9f2e5b8d1a4c7f0e3b6d9a2c5f8e1b4d7a0c3f6e9b2d5a8c',
    statements: [
      `CREATE TABLE IF NOT EXISTS work_management_projects (
        project_id VARCHAR(191) PRIMARY KEY,
        header_id VARCHAR(191) NOT NULL,
        name VARCHAR(500) NOT NULL,
        status VARCHAR(32) NOT NULL,
        owner VARCHAR(191) NULL,
        source_opportunity_id VARCHAR(191) NULL,
        registry_project_id VARCHAR(191) NULL,
        metadata_json JSON NOT NULL,
        created_at DATETIME(3) NOT NULL,
        updated_at DATETIME(3) NOT NULL,
        INDEX idx_wm_projects_status (status),
        INDEX idx_wm_projects_owner (owner)
      )`,
      `CREATE TABLE IF NOT EXISTS work_management_tasks (
        task_id VARCHAR(191) PRIMARY KEY,
        header_id VARCHAR(191) NOT NULL,
        epic_id VARCHAR(191) NOT NULL,
        project_id VARCHAR(191) NOT NULL,
        title VARCHAR(500) NOT NULL,
        description TEXT NOT NULL,
        status VARCHAR(32) NOT NULL,
        work_class VARCHAR(32) NOT NULL,
        acceptance_criteria_json JSON NOT NULL,
        capability_ids_json JSON NOT NULL,
        owner VARCHAR(191) NULL,
        assigned_agent_id VARCHAR(191) NULL,
        sprint_id VARCHAR(191) NULL,
        work_package_id VARCHAR(191) NULL,
        metadata_json JSON NOT NULL,
        created_at DATETIME(3) NOT NULL,
        updated_at DATETIME(3) NOT NULL,
        INDEX idx_wm_tasks_project_status (project_id, status),
        INDEX idx_wm_tasks_assigned_agent (assigned_agent_id)
      )`,
    ],
  },
];
