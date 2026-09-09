import type { MySqlMigration } from './migrations.js';

/** Durable Memory Access tables used by JARVIS and other governed memory clients. */
export const JARVIS_MEMORY_MIGRATIONS: readonly MySqlMigration[] = [
  {
    id: 'jarvis_memory_access_v1',
    checksum: '9e4b7c2d6f8a1b3c5d7e9f0a2c4e6b8d1f3a5c7e9b0d2f4a6c8e1b3d5f7a9c2',
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
