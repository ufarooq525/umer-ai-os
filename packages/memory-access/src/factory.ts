import { InMemoryMemoryStore } from './store.js';
import { InMemoryVectorStore } from './vector.js';
import { MemoryAccessService, type MemoryAccessServiceOptions } from './service.js';

export type CreateMemoryAccessOptions = MemoryAccessServiceOptions;

export function createMemoryAccessService(
  options?: Partial<CreateMemoryAccessOptions>,
): MemoryAccessService {
  return new MemoryAccessService({
    store: options?.store ?? new InMemoryMemoryStore(),
    vectorStore: options?.vectorStore ?? new InMemoryVectorStore(),
    embedder: options?.embedder,
    scopeGuard: options?.scopeGuard,
    events: options?.events,
    clock: options?.clock,
  });
}

export function createMemoryStack(): {
  service: MemoryAccessService;
  store: InMemoryMemoryStore;
  vectorStore: InMemoryVectorStore;
} {
  const store = new InMemoryMemoryStore();
  const vectorStore = new InMemoryVectorStore();
  const service = createMemoryAccessService({ store, vectorStore });
  return { service, store, vectorStore };
}
