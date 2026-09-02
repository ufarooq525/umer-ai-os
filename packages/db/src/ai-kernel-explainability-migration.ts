import type { MySqlMigration } from './migrations.js';

/** Structured decision context so the CEO can inspect why work was created and executed. */
export const AI_KERNEL_EXPLAINABILITY_MIGRATIONS: readonly MySqlMigration[] = [
  {
    id: '008_ai_kernel_explainability',
    checksum: '3c8e1f7a9d4b2e6c5f0a8d1b7e3c9f2a6d5b8e0f4c7a1d9e6b2f5c8a3d7e1b4',
    statements: [
      `ALTER TABLE ai_tasks ADD COLUMN IF NOT EXISTS why_json JSON NULL AFTER instructions`,
      `ALTER TABLE ai_tasks ADD COLUMN IF NOT EXISTS entity_type VARCHAR(64) NULL AFTER project_id`,
      `ALTER TABLE ai_tasks ADD COLUMN IF NOT EXISTS entity_id VARCHAR(191) NULL AFTER entity_type`,
      `CREATE INDEX idx_ai_tasks_entity ON ai_tasks (entity_type, entity_id, created_at)`,
    ],
  },
];
