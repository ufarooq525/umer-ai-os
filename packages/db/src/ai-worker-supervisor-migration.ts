import type { MySqlMigration } from './migrations.js';

/** Durable worker-supervisor state: heartbeats, reconciliation and execution health. */
export const AI_WORKER_SUPERVISOR_MIGRATIONS: readonly MySqlMigration[] = [
  {
    id: '010_ai_worker_supervisor',
    checksum: '6d2f4a8c1b9e73f0c5a2d8e4b7f1c9a3e6d0b5c8f2a7e1d4c9b6f3a8d2e5c7b1',
    statements: [
      `CREATE TABLE IF NOT EXISTS ai_worker_heartbeats (
        heartbeat_id VARCHAR(191) PRIMARY KEY,
        agent_id VARCHAR(128) NOT NULL,
        worker_id VARCHAR(191) NOT NULL,
        status VARCHAR(32) NOT NULL,
        queue_depth INT UNSIGNED NOT NULL DEFAULT 0,
        active_tasks INT UNSIGNED NOT NULL DEFAULT 0,
        last_task_id VARCHAR(191) NULL,
        metadata_json JSON NULL,
        occurred_at DATETIME(3) NOT NULL,
        INDEX idx_ai_worker_heartbeat_agent (agent_id, occurred_at),
        INDEX idx_ai_worker_heartbeat_worker (worker_id, occurred_at)
      )`,
      `CREATE TABLE IF NOT EXISTS ai_worker_supervisor_events (
        event_id VARCHAR(191) PRIMARY KEY,
        event_type VARCHAR(64) NOT NULL,
        agent_id VARCHAR(128) NULL,
        worker_id VARCHAR(191) NULL,
        severity VARCHAR(16) NOT NULL DEFAULT 'info',
        message TEXT NOT NULL,
        metadata_json JSON NULL,
        occurred_at DATETIME(3) NOT NULL,
        INDEX idx_ai_worker_supervisor_time (occurred_at),
        INDEX idx_ai_worker_supervisor_agent (agent_id, occurred_at)
      )`,
    ],
  },
];
