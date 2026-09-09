import type { MemoryKind } from '@umer/contracts';
import { createMySqlClient, createMySqlExecutor } from '@umer/db';
import {
  createMemoryStack,
  createPersistentMemoryService,
  MySqlMemoryStore,
  MySqlVectorStore,
  type MemoryAccessPrincipal,
  type MemoryAccessService,
  type RetrievalBundle,
} from '@umer/memory-access';

export type JarvisMemoryOptions = { principal?: MemoryAccessPrincipal; service?: MemoryAccessService };
export type JarvisMemory = {
  retrieve(query: string, options?: { limit?: number; memoryKinds?: MemoryKind[] }): Promise<RetrievalBundle>;
  principal: MemoryAccessPrincipal;
  delete(memoryId: string, correlationId: string): Promise<boolean>;
};

const defaultPrincipal: MemoryAccessPrincipal = { principalId: 'jarvis', grantedScopes: ['read'] };

export function createJarvisMemory(options: JarvisMemoryOptions = {}): JarvisMemory {
  const stack = options.service ? undefined : createMemoryStack();
  const service = options.service ?? stack!.service;
  const principal = options.principal ?? defaultPrincipal;
  return {
    principal,
    async retrieve(query, retrievalOptions = {}) {
      return service.retrieve({ query, limit: Math.min(Math.max(retrievalOptions.limit ?? 5, 1), 10), memoryKinds: retrievalOptions.memoryKinds }, principal, `jarvis:memory:${principal.principalId}`);
    },
    async delete(memoryId, correlationId) { return service.delete(memoryId, principal, correlationId); },
  };
}

/** Uses the repository's MySQL database as the durable Memory Access backend. Run the DB migration before constructing this service. */
export function createPersistentJarvisMemory(options: { principal?: MemoryAccessPrincipal; connectionString?: string } = {}): JarvisMemory {
  const executor = createMySqlExecutor(createMySqlClient(options.connectionString));
  const service = createPersistentMemoryService({ store: new MySqlMemoryStore(executor), vectorStore: new MySqlVectorStore(executor) });
  return createJarvisMemory({ service, principal: options.principal });
}

export type { MemoryAccessPrincipal, MemoryKind, RetrievalBundle };
