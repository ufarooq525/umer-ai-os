import type { MemoryKind, MemoryScope } from '@umer/contracts';
import {
  createMemoryStack,
  type MemoryAccessPrincipal,
  type MemoryAccessService,
  type RetrievalBundle,
} from '@umer/memory-access';

export type JarvisMemoryOptions = {
  principal?: MemoryAccessPrincipal;
  service?: MemoryAccessService;
};

export type JarvisMemory = {
  retrieve(query: string, options?: { limit?: number; memoryKinds?: MemoryKind[] }): Promise<RetrievalBundle>;
  principal: MemoryAccessPrincipal;
};

const defaultPrincipal: MemoryAccessPrincipal = {
  principalId: 'jarvis',
  grantedScopes: ['read'],
};

export function createJarvisMemory(options: JarvisMemoryOptions = {}): JarvisMemory {
  const stack = options.service ? undefined : createMemoryStack();
  const service = options.service ?? stack!.service;
  const principal = options.principal ?? defaultPrincipal;

  return {
    principal,
    async retrieve(query, retrievalOptions = {}) {
      return service.retrieve(
        {
          query,
          limit: Math.min(Math.max(retrievalOptions.limit ?? 5, 1), 10),
          memoryKinds: retrievalOptions.memoryKinds,
        },
        principal,
        `jarvis:memory:${principal.principalId}`,
      );
    },
  };
}

export type { MemoryAccessPrincipal, MemoryKind, MemoryScope, RetrievalBundle };
