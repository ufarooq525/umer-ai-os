import type { MySqlMigration } from './migrations.js';

/** Telemetry that is intentionally separate from durable task state. */
export const AI_KERNEL_TELEMETRY_MIGRATIONS: readonly MySqlMigration[] = [
  {
    id: '006_ai_kernel_tool_usage',
    checksum: '6f1a9d7c4b2e8f0a5c3d7e9b1f4a6c8d0e2b5f7a9c1d3e5f8b0a2c4d6e9f1a3b',
    statements: [
      `CREATE TABLE IF NOT EXISTS ai_tool_usage (
        usage_id VARCHAR(191) PRIMARY KEY,
        task_id VARCHAR(191) NULL,
        agent_id VARCHAR(128) NULL,
        tool_id VARCHAR(191) NULL,
        tool_name VARCHAR(255) NOT NULL,
        input_hash CHAR(64) NULL,
        cache_hit BOOLEAN NOT NULL DEFAULT FALSE,
        latency_ms INT UNSIGNED NULL,
        estimated_cost DECIMAL(18,8) NOT NULL DEFAULT 0,
        success BOOLEAN NOT NULL DEFAULT TRUE,
        error_message TEXT NULL,
        created_at DATETIME(3) NOT NULL,
        INDEX idx_ai_tool_usage_task (task_id, created_at),
        INDEX idx_ai_tool_usage_agent (agent_id, created_at),
        INDEX idx_ai_tool_usage_tool (tool_name, created_at)
      )`,
    ],
  },
];
