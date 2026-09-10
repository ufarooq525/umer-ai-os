import { createHash } from 'node:crypto';
import type { MySqlMigration } from './migrations.js';

const STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS trust_grants (
    grant_id VARCHAR(191) PRIMARY KEY,
    principal_id VARCHAR(191) NOT NULL,
    action VARCHAR(64) NOT NULL,
    resource_type VARCHAR(64) NOT NULL,
    resource_id VARCHAR(191) NULL,
    effect VARCHAR(8) NOT NULL,
    tenant_id VARCHAR(191) NULL,
    created_at DATETIME(3) NOT NULL,
    INDEX idx_trust_grants_principal (principal_id)
  )`,
];

const checksum = createHash('sha256')
  .update(STATEMENTS.map((s) => s.trim().replace(/\s+/g, ' ')).join('\n'))
  .digest('hex');

/** Durable Trust grants — replaces re-deriving grants from startup environment variables on every restart. */
export const TRUST_GRANTS_MIGRATIONS: readonly MySqlMigration[] = [
  {
    id: 'jarvis_trust_grants_v1',
    checksum,
    statements: STATEMENTS,
  },
];
