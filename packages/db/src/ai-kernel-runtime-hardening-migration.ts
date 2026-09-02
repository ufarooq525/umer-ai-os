import type { MySqlMigration } from './migrations.js';

/** Backward-compatible columns required by the live kernel runtime. */
export const AI_KERNEL_RUNTIME_HARDENING_MIGRATIONS: readonly MySqlMigration[] = [
  {
    id: '007_ai_kernel_runtime_hardening',
    checksum: '9b8f2e4d1c7a6f3e5d0b9a2c8e4f1d7a6b3c5e9f0a8d2c4b7e1f6a9d3c8b5e2',
    statements: [
      `ALTER TABLE ai_tasks ADD COLUMN IF NOT EXISTS required_capability VARCHAR(128) NULL AFTER assigned_agent_id`,
      `ALTER TABLE ai_tasks ADD COLUMN IF NOT EXISTS claimed_at DATETIME(3) NULL AFTER started_at`,
      `ALTER TABLE ai_tasks ADD COLUMN IF NOT EXISTS updated_at DATETIME(3) NULL AFTER created_at`,
      `ALTER TABLE ai_task_leases ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' AFTER heartbeat_at`,
      `ALTER TABLE ai_task_leases ADD COLUMN IF NOT EXISTS released_at DATETIME(3) NULL AFTER status`,
      `CREATE INDEX idx_ai_tasks_capability_queue ON ai_tasks (required_capability, status, priority, created_at)`,
      `CREATE INDEX idx_ai_task_leases_status_expiry ON ai_task_leases (status, lease_until)`,
    ],
  },
];
