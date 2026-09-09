/**
 * @umer/memory-access — Memory Access Runtime plumbing (CRUD, vector search, scope enforcement).
 */
export { packageName } from './types.js';
export type { MemoryAccessPrincipal, RetrievalRequest, RetrievalCitation, RetrievalBundle, WritebackReceipt } from './types.js';
export { MemoryAccessError, type MemoryAccessErrorCode } from './errors.js';
export { type MemoryStore, InMemoryMemoryStore, MySqlMemoryStore, type MemorySqlExecutor } from './store.js';
export { type VectorStore, type MemoryChunk, type VectorSearchResult, InMemoryVectorStore, MySqlVectorStore, type VectorSqlExecutor, cosineSimilarity } from './vector.js';
export { type Embedder, createDeterministicEmbedder } from './embed.js';
export { type ScopeGuard, type ScopeOperation, createScopeGuard, allowAllScopeGuard, assertPrincipalWrite } from './scope.js';
export { type MemoryEventPublisher, createNoopMemoryEventPublisher } from './events.js';
export { MemoryAccessService, type MemoryAccessServiceOptions, type CreateMemoryInput, type Clock, systemClock } from './service.js';
export { createMemoryAccessService, createMemoryStack, createPersistentMemoryService, type CreateMemoryAccessOptions } from './factory.js';
