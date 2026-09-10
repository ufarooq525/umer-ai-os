import { createHash } from 'node:crypto';
import type { MySqlMigration } from './migrations.js';

const STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS specialist_control (
    specialist_id VARCHAR(191) PRIMARY KEY,
    control_state VARCHAR(16) NOT NULL,
    reason VARCHAR(1000) NULL,
    updated_at DATETIME(3) NOT NULL
  )`,
];

const checksum = createHash('sha256')
  .update(STATEMENTS.map((s) => s.trim().replace(/\s+/g, ' ')).join('\n'))
  .digest('hex');

/**
 * Durable specialist-type lifecycle overrides (SuspendSpecialist /
 * ActivateSpecialist CEO commands). Sparse by design — a missing row means
 * `active`; this table is never seeded with a canonical list of every
 * specialist that could exist.
 */
export const SPECIALIST_CONTROL_MIGRATIONS: readonly MySqlMigration[] = [
  {
    id: 'specialist_control_v1',
    checksum,
    statements: STATEMENTS,
  },
];
