import type { MySqlMigration } from './migrations.js';

/** CEO control audit plus explainable business outcome lineage. */
export const AI_OS_CONTROL_LINEAGE_MIGRATIONS: readonly MySqlMigration[] = [
  {
    id: '009_ai_os_control_lineage',
    checksum: '9f4b7c1d8e2a6f3051c9d7b4e3a8f6c2d0b1e5a7946328cf0d2a1b7c9e4f6853',
    statements: [
      `CREATE TABLE IF NOT EXISTS ai_control_audit_events (
        audit_id VARCHAR(191) PRIMARY KEY,
        action VARCHAR(64) NOT NULL,
        target_type VARCHAR(64) NOT NULL,
        target_id VARCHAR(191) NOT NULL,
        actor_type VARCHAR(32) NOT NULL DEFAULT 'CEO',
        actor_id VARCHAR(191) NULL,
        reason TEXT NULL,
        before_json JSON NULL,
        after_json JSON NULL,
        occurred_at DATETIME(3) NOT NULL,
        INDEX idx_ai_control_target (target_type, target_id, occurred_at),
        INDEX idx_ai_control_action (action, occurred_at)
      )`,
      `CREATE TABLE IF NOT EXISTS ai_business_lineage (
        lineage_id VARCHAR(191) PRIMARY KEY,
        from_type VARCHAR(64) NOT NULL,
        from_id VARCHAR(191) NOT NULL,
        relation VARCHAR(64) NOT NULL,
        to_type VARCHAR(64) NOT NULL,
        to_id VARCHAR(191) NOT NULL,
        confidence DECIMAL(6,3) NULL,
        why_json JSON NULL,
        metadata_json JSON NULL,
        created_by_type VARCHAR(32) NOT NULL DEFAULT 'SYSTEM',
        created_by_id VARCHAR(191) NULL,
        created_at DATETIME(3) NOT NULL,
        UNIQUE KEY uq_ai_lineage_edge (from_type, from_id, relation, to_type, to_id),
        INDEX idx_ai_lineage_from (from_type, from_id),
        INDEX idx_ai_lineage_to (to_type, to_id),
        INDEX idx_ai_lineage_relation (relation, created_at)
      )`,
      `CREATE TABLE IF NOT EXISTS ai_business_outcomes (
        outcome_id VARCHAR(191) PRIMARY KEY,
        entity_type VARCHAR(64) NOT NULL,
        entity_id VARCHAR(191) NOT NULL,
        outcome_type VARCHAR(64) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'OPEN',
        amount DECIMAL(18,8) NULL,
        currency CHAR(3) NOT NULL DEFAULT 'USD',
        occurred_at DATETIME(3) NULL,
        metadata_json JSON NULL,
        created_at DATETIME(3) NOT NULL,
        INDEX idx_ai_outcome_entity (entity_type, entity_id),
        INDEX idx_ai_outcome_type (outcome_type, occurred_at)
      )`,
    ],
  },
];
