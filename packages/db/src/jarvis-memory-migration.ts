import type { MySqlMigration } from './migrations.js';

/** Durable Memory Access tables used by JARVIS and other governed memory clients. */
export const JARVIS_MEMORY_MIGRATIONS: readonly MySqlMigration[] = [
  {
    id: '019_jarvis_memory_access',
    checksum: '8d2c1f7a4b6e9c3d5f0a2b4c6e8f1d3a5b7c9e0f2a4c6d8e1f3b5a7c9d0e2f4',
    statements: [
      `CREATE TABLE IF NOT EXISTS memory_access_memories (
        memory_id VARCHAR(191) PRIMARY KEY,
        schema_version VARCHAR(64) NOT NULL,
        memory_kind VARCHAR(32) NOT NULL,
        scope VARCHAR(16) NOT NULL,
        tenant_id VARCHAR(191) NULL,
        title VARCHAR(512) NOT NULL,
        content_ref VARCHAR(2048) NOT NULL,
        embedding_ref VARCHAR(2048) NULL,
        tags_json JSON NOT NULL,
        retention_class VARCHAR(16) NOT NULL,
        created_at DATETIME(3) NOT NULL,
        updated_at DATETIME(3) NOT NULL,
        INDEX idx_memory_access_tenant (tenant_id),
        INDEX idx_memory_access_kind (memory_kind),
        INDEX idx_memory_access_updated (updated_at)
      )`,
      `CREATE TABLE IF NOT EXISTS memory_access_chunks (
        chunk_id VARCHAR(191) PRIMARY KEY,
        memory_id VARCHAR(191) NOT NULL,
        text LONGTEXT NOT NULL,
        embedding_json JSON NOT NULL,
        memory_kind VARCHAR(32) NULL,
        tenant_id VARCHAR(191) NULL,
        INDEX idx_memory_chunks_memory (memory_id),
        INDEX idx_memory_chunks_tenant (tenant_id),
        CONSTRAINT fk_memory_chunks_memory FOREIGN KEY (memory_id) REFERENCES memory_access_memories(memory_id) ON DELETE CASCADE
      )`,
    ],
  },
];
