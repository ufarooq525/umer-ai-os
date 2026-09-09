import { randomUUID } from 'node:crypto';
import type { MemoryKind } from '@umer/contracts';
import { createMySqlClient, createMySqlExecutor } from '@umer/db';
import { createMemoryStack, createPersistentMemoryService, MySqlMemoryStore, MySqlVectorStore, type MemoryAccessPrincipal, type MemoryAccessService, type RetrievalBundle } from '@umer/memory-access';

export type JarvisMemoryOptions = { principal?: MemoryAccessPrincipal; service?: MemoryAccessService };
export type JarvisMemory = {
  retrieve(query: string, options?: { limit?: number; memoryKinds?: MemoryKind[] }): Promise<RetrievalBundle>;
  rememberTurn(sessionId: string, userMessage: string, assistantMessage: string, correlationId: string): Promise<void>;
  delete(memoryId: string, correlationId: string): Promise<boolean>;
  principal: MemoryAccessPrincipal;
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
    async rememberTurn(sessionId, userMessage, assistantMessage, correlationId) {
      if (!principal.grantedScopes.includes('write') && !principal.grantedScopes.includes('read_write')) return;
      const memoryId = randomUUID();
      const content = `User: ${userMessage}\nJARVIS: ${assistantMessage}`;
      await service.writeback({
        memory: {
          kind: 'memory', memoryId, memoryKind: 'WorkingNote', scope: 'read_write',
          title: `JARVIS conversation ${sessionId}`, contentRef: `jarvis://sessions/${sessionId}/memories/${memoryId}`,
          tags: ['jarvis', 'conversation'], retentionClass: 'durable',
        },
        content, principal,
      }, correlationId);
    },
    async delete(memoryId, correlationId) { return service.delete(memoryId, principal, correlationId); },
  };
}

/** Uses the repository's MySQL database as the durable Memory Access backend. DB migrations must be applied first. */
export function createPersistentJarvisMemory(options: { principal?: MemoryAccessPrincipal; connectionString?: string } = {}): JarvisMemory {
  const executor = createMySqlExecutor(createMySqlClient(options.connectionString));
  const service = createPersistentMemoryService({ store: new MySqlMemoryStore(executor), vectorStore: new MySqlVectorStore(executor) });
  return createJarvisMemory({ service, principal: options.principal });
}

export type { MemoryAccessPrincipal, MemoryKind, RetrievalBundle };
