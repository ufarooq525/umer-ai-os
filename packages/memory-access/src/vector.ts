export type MemoryChunk = {
  chunkId: string;
  memoryId: string;
  text: string;
  embedding: number[];
  memoryKind?: string;
  tenantId?: string;
};

export type VectorSearchResult = {
  chunk: MemoryChunk;
  score: number;
};

export type VectorStore = {
  upsert(chunk: MemoryChunk): Promise<void>;
  search(embedding: number[], options?: { limit?: number; memoryIds?: string[] }): Promise<VectorSearchResult[]>;
  deleteByMemoryId(memoryId: string): Promise<void>;
};

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0; let normA = 0; let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i]! * b[i]!; normA += a[i]! * a[i]!; normB += b[i]! * b[i]!;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export class InMemoryVectorStore implements VectorStore {
  private readonly chunks = new Map<string, MemoryChunk>();
  async upsert(chunk: MemoryChunk): Promise<void> { this.chunks.set(chunk.chunkId, structuredClone(chunk)); }
  async search(embedding: number[], options?: { limit?: number; memoryIds?: string[] }): Promise<VectorSearchResult[]> {
    const limit = options?.limit ?? 10;
    const allowed = options?.memoryIds ? new Set(options.memoryIds) : undefined;
    return [...this.chunks.values()]
      .filter((chunk) => !allowed || allowed.has(chunk.memoryId))
      .map((chunk) => ({ chunk, score: cosineSimilarity(embedding, chunk.embedding) }))
      .sort((a, b) => b.score - a.score).slice(0, limit);
  }
  async deleteByMemoryId(memoryId: string): Promise<void> {
    for (const [id, chunk] of this.chunks) if (chunk.memoryId === memoryId) this.chunks.delete(id);
  }
  clear(): void { this.chunks.clear(); }
}

export type VectorSqlExecutor = {
  execute<T = unknown>(sql: string, params?: readonly unknown[]): Promise<T>;
};

type VectorRow = { chunk_id: string; memory_id: string; text: string; embedding_json: string | object; memory_kind: string | null; tenant_id: string | null };

function toChunk(row: VectorRow): MemoryChunk {
  const parsed = typeof row.embedding_json === 'string' ? JSON.parse(row.embedding_json) : row.embedding_json;
  return { chunkId: row.chunk_id, memoryId: row.memory_id, text: row.text, embedding: parsed as number[], memoryKind: row.memory_kind ?? undefined, tenantId: row.tenant_id ?? undefined };
}

/** Durable MySQL vector store. Embeddings remain provider-neutral JSON so existing deterministic/local embeddings work unchanged. */
export class MySqlVectorStore implements VectorStore {
  constructor(private readonly db: VectorSqlExecutor) {}
  async upsert(chunk: MemoryChunk): Promise<void> {
    await this.db.execute(
      `INSERT INTO memory_access_chunks (chunk_id, memory_id, text, embedding_json, memory_kind, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE text=VALUES(text), embedding_json=VALUES(embedding_json), memory_kind=VALUES(memory_kind), tenant_id=VALUES(tenant_id)`,
      [chunk.chunkId, chunk.memoryId, chunk.text, JSON.stringify(chunk.embedding), chunk.memoryKind ?? null, chunk.tenantId ?? null],
    );
  }
  async search(embedding: number[], options?: { limit?: number; memoryIds?: string[] }): Promise<VectorSearchResult[]> {
    const limit = Math.min(Math.max(options?.limit ?? 10, 1), 1000);
    const rows = await this.db.execute<VectorRow[]>('SELECT chunk_id, memory_id, text, embedding_json, memory_kind, tenant_id FROM memory_access_chunks');
    const allowed = options?.memoryIds ? new Set(options.memoryIds) : undefined;
    return rows.filter((row) => !allowed || allowed.has(row.memory_id))
      .map((row) => { const chunk = toChunk(row); return { chunk, score: cosineSimilarity(embedding, chunk.embedding) }; })
      .sort((a, b) => b.score - a.score).slice(0, limit);
  }
  async deleteByMemoryId(memoryId: string): Promise<void> {
    await this.db.execute('DELETE FROM memory_access_chunks WHERE memory_id = ?', [memoryId]);
  }
}
