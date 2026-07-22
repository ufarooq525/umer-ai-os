export type Embedder = {
  embed(text: string): Promise<number[]>;
};

const EMBEDDING_DIM = 16;

/**
 * Deterministic local embedder for tests and M7 — no external model calls.
 */
export function createDeterministicEmbedder(dim = EMBEDDING_DIM): Embedder {
  return {
    async embed(text: string): Promise<number[]> {
      const vector = new Array<number>(dim).fill(0);
      const normalized = text.toLowerCase().trim();
      for (let i = 0; i < normalized.length; i += 1) {
        const code = normalized.charCodeAt(i);
        const index = code % dim;
        vector[index] = (vector[index] ?? 0) + ((code % 97) + 1) / 100;
      }
      return vector;
    },
  };
}
