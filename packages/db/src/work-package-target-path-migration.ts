import type { MySqlMigration } from './migrations.js';

/**
 * Adds the `target_path` column WorkPackageContract's `targetPath` field
 * needed (added to the contract in a later pass than `013_orchestration_work_packages`,
 * which predates it) — found live: MySqlWorkPackageStore silently dropped
 * `targetPath` on every round trip through MySQL because neither the table
 * nor the store's read/write mapping ever accounted for it, so a Specialist
 * dispatched via the MySQL-backed store (as opposed to the in-memory store
 * every orchestration package test uses) never actually received the real
 * project root its tools needed. A separate migration, not an edit to
 * `013`'s already-applied statements — `migrate()` re-runs every migration's
 * statements every time and tolerates `ER_DUP_FIELDNAME` (see packages/db's
 * `migrate()`), so `ADD COLUMN` here is the same idempotent-by-tolerance
 * pattern already used across every existing migration in this codebase.
 */
export const WORK_PACKAGE_TARGET_PATH_MIGRATIONS: readonly MySqlMigration[] = [
  {
    id: '017_orchestration_work_packages_target_path',
    checksum: '4f8a1c6e9b2d5f0a3c7e1b4d8f2a5c9e6b3d0f7a1c4e8b2d5f9a3c6e0b4d7f1a',
    statements: [
      `ALTER TABLE orchestration_work_packages ADD COLUMN target_path VARCHAR(1024) NULL`,
    ],
  },
];
