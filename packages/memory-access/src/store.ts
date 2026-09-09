import type { MemoryContract } from '@umer/contracts';

export type MemoryStore = {
  save(memory: MemoryContract): Promise<void>;
  get(memoryId: string): Promise<MemoryContract | undefined>;
  list(): Promise<MemoryContract[]>;
  delete(memoryId: string): Promise<boolean>;
};

export class InMemoryMemoryStore implements MemoryStore {
  private readonly records = new Map<string, MemoryContract>();

  async save(memory: MemoryContract): Promise<void> {
    this.records.set(memory.memoryId, structuredClone(memory));
  }

  async get(memoryId: string): Promise<MemoryContract | undefined> {
    return this.records.get(memoryId);
  }

  async list(): Promise<MemoryContract[]> {
    return [...this.records.values()];
  }

  async delete(memoryId: string): Promise<boolean> {
    return this.records.delete(memoryId);
  }

  clear(): void {
    this.records.clear();
  }
}

export type MemorySqlExecutor = {
  execute<T = unknown>(sql: string, params?: readonly unknown[]): Promise<T>;
};

type MemoryRow = {
  memory_id: string;
  schema_version: string;
  memory_kind: string;
  scope: string;
  tenant_id: string | null;
  title: string;
  content_ref: string;
  embedding_ref: string | null;
  tags_json: string | object | null;
  retention_class: string;
  created_at: string;
  updated_at: string;
};

function jsonValue(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return value; }
}

function toContract(row: MemoryRow): MemoryContract {
  return {
    kind: 'memory',
    schemaVersion: row.schema_version as MemoryContract['schemaVersion'],
    memoryId: row.memory_id,
    memoryKind: row.memory_kind as MemoryContract['memoryKind'],
    scope: row.scope as MemoryContract['scope'],
    tenantId: row.tenant_id ?? undefined,
    title: row.title,
    contentRef: row.content_ref,
    embeddingRef: row.embedding_ref ?? undefined,
    tags: (jsonValue(row.tags_json) as string[] | undefined) ?? [],
    retentionClass: row.retention_class as MemoryContract['retentionClass'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Durable MySQL Memory Access store. The SQL executor is injected to keep the runtime decoupled from a specific DB client. */
export class MySqlMemoryStore implements MemoryStore {
  constructor(private readonly db: MemorySqlExecutor) {}

  async save(memory: MemoryContract): Promise<void> {
    await this.db.execute(
      `INSERT INTO memory_access_memories
        (memory_id, schema_version, memory_kind, scope, tenant_id, title, content_ref, embedding_ref, tags_json, retention_class, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        schema_version=VALUES(schema_version), memory_kind=VALUES(memory_kind), scope=VALUES(scope), tenant_id=VALUES(tenant_id),
        title=VALUES(title), content_ref=VALUES(content_ref), embedding_ref=VALUES(embedding_ref), tags_json=VALUES(tags_json),
        retention_class=VALUES(retention_class), updated_at=VALUES(updated_at)`,
      [memory.memoryId, memory.schemaVersion, memory.memoryKind, memory.scope, memory.tenantId ?? null, memory.title,
        memory.contentRef, memory.embeddingRef ?? null, JSON.stringify(memory.tags ?? []), memory.retentionClass, memory.createdAt, memory.updatedAt],
    );
  }

  async get(memoryId: string): Promise<MemoryContract | undefined> {
    const rows = await this.db.execute<MemoryRow[]>(
      'SELECT memory_id, schema_version, memory_kind, scope, tenant_id, title, content_ref, embedding_ref, tags_json, retention_class, created_at, updated_at FROM memory_access_memories WHERE memory_id = ? LIMIT 1',
      [memoryId],
    );
    return rows[0] ? toContract(rows[0]) : undefined;
  }

  async list(): Promise<MemoryContract[]> {
    const rows = await this.db.execute<MemoryRow[]>(
      'SELECT memory_id, schema_version, memory_kind, scope, tenant_id, title, content_ref, embedding_ref, tags_json, retention_class, created_at, updated_at FROM memory_access_memories ORDER BY updated_at DESC',
    );
    return rows.map(toContract);
  }

  async delete(memoryId: string): Promise<boolean> {
    const result = await this.db.execute<{ affectedRows?: number }>(
      'DELETE FROM memory_access_memories WHERE memory_id = ?', [memoryId],
    );
    return Number(result?.affectedRows ?? 0) > 0;
  }
}
