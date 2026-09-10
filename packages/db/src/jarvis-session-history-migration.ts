import { createHash } from 'node:crypto';
import type { MySqlMigration } from './migrations.js';

const STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS jarvis_session_turns (
    turn_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(191) NOT NULL,
    role VARCHAR(16) NOT NULL,
    content LONGTEXT NOT NULL,
    created_at DATETIME(3) NOT NULL,
    INDEX idx_jarvis_session_turns_session (session_id, turn_id)
  )`,
];

const checksum = createHash('sha256')
  .update(STATEMENTS.map((s) => s.trim().replace(/\s+/g, ' ')).join('\n'))
  .digest('hex');

/** Durable JARVIS conversation history — replaces the anonymous in-memory session Map. */
export const JARVIS_SESSION_HISTORY_MIGRATIONS: readonly MySqlMigration[] = [
  {
    id: 'jarvis_session_history_v1',
    checksum,
    statements: STATEMENTS,
  },
];
