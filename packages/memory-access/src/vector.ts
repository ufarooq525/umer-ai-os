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
  search(
    embedding: number[],
    options?: { limit?: number; memoryIds?: string[] },
  ): Promise<VectorSearchResult[]>;
  deleteByMemoryId(memoryId: string): Promise<void>;
};

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export class InMemoryVectorStore implements VectorStore {
  private readonly chunks = new Map<string, MemoryChunk>();

  async upsert(chunk: MemoryChunk): Promise<void> {
    this.chunks.set(chunk.chunkId, structuredClone(chunk));
  }

  async search(
    embedding: number[],
    options?: { limit?: number; memoryIds?: string[] },
  ): Promise<VectorSearchResult[]> {
    const limit = options?.limit ?? 10;
    const allowed = options?.memoryIds ? new Set(options.memoryIds) : undefined;
    const results: VectorSearchResult[] = [];

    for (const chunk of this.chunks.values()) {
      if (allowed && !allowed.has(chunk.memoryId)) {
        continue;
      }
      results.push({
        chunk,
        score: cosineSimilarity(embedding, chunk.embedding),
      });
    }

    return results
      .sort((left, right) => right.score - left.score)
      .slice(0, limit);
  }

  async deleteByMemoryId(memoryId: string): Promise<void> {
    for (const [chunkId, chunk] of this.chunks) {
      if (chunk.memoryId === memoryId) {
        this.chunks.delete(chunkId);
      }
    }
  }

  clear(): void {
    this.chunks.clear();
  }
}
