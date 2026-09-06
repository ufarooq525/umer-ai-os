import type { MySqlMigration } from './migrations.js';

/** Agent Run read model + Agent Registry — @umer/observability's live event projections. */
export const OBSERVABILITY_MIGRATIONS: readonly MySqlMigration[] = [
  {
    id: '016_observability_agent_runs_and_agents',
    checksum: '4c7f0a3d6b9e2c5f8a1d4b7e0c3f6a9d2b5e8c1f4a7d0b3e6c9f2a5d8b1e4c7f',
    statements: [
      `CREATE TABLE IF NOT EXISTS observability_agent_runs (
        work_package_id VARCHAR(191) PRIMARY KEY,
        run_id VARCHAR(191) NULL,
        exec_id VARCHAR(191) NULL,
        specialist_id VARCHAR(191) NULL,
        agent_id VARCHAR(191) NULL,
        task_ids_json JSON NULL,
        correlation_id VARCHAR(191) NOT NULL,
        status VARCHAR(16) NOT NULL,
        current_action VARCHAR(32) NOT NULL,
        current_tool VARCHAR(191) NULL,
        current_tool_input_json JSON NULL,
        started_at DATETIME(3) NOT NULL,
        updated_at DATETIME(3) NOT NULL,
        finished_at DATETIME(3) NULL,
        tool_calls_json JSON NOT NULL,
        decisions_json JSON NOT NULL,
        action_log_json JSON NOT NULL,
        failures_json JSON NOT NULL,
        artifact_id VARCHAR(191) NULL,
        summary TEXT NULL,
        error_message TEXT NULL,
        INDEX idx_agent_runs_status (status),
        INDEX idx_agent_runs_agent (agent_id)
      )`,
      `CREATE TABLE IF NOT EXISTS observability_agents (
        agent_id VARCHAR(191) PRIMARY KEY,
        specialist_id VARCHAR(191) NOT NULL,
        name VARCHAR(255) NULL,
        department VARCHAR(191) NULL,
        capability_ids_json JSON NULL,
        status VARCHAR(16) NOT NULL,
        last_seen_at DATETIME(3) NOT NULL,
        current_work_package_id VARCHAR(191) NULL,
        current_task_ids_json JSON NULL,
        current_agent_run_id VARCHAR(191) NULL,
        correlation_id VARCHAR(191) NULL,
        INDEX idx_agents_status (status),
        INDEX idx_agents_department (department),
        INDEX idx_agents_specialist (specialist_id)
      )`,
    ],
  },
];
