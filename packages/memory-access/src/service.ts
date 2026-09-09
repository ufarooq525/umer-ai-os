import { randomUUID } from 'node:crypto';
import { parseContract, SCHEMA_VERSION, MemoryContractSchema, type MemoryContract } from '@umer/contracts';
import type { MemoryStore } from './store.js';
import type { VectorStore } from './vector.js';
import type { Embedder } from './embed.js';
import { createDeterministicEmbedder } from './embed.js';
import type { ScopeGuard } from './scope.js';
import { createScopeGuard, assertPrincipalWrite } from './scope.js';
import type { MemoryEventPublisher } from './events.js';
import { createNoopMemoryEventPublisher } from './events.js';
import { MemoryAccessError } from './errors.js';
import type { MemoryAccessPrincipal, RetrievalBundle, RetrievalCitation, RetrievalRequest, WritebackReceipt } from './types.js';

export type Clock = { nowIso(): string };
export const systemClock: Clock = { nowIso() { return new Date().toISOString(); } };
export type MemoryAccessServiceOptions = { store: MemoryStore; vectorStore: VectorStore; embedder?: Embedder; scopeGuard?: ScopeGuard; events?: MemoryEventPublisher; clock?: Clock };
export type CreateMemoryInput = { memory: Omit<MemoryContract, 'id' | 'schemaVersion' | 'createdAt' | 'updatedAt'>; content: string; principal: MemoryAccessPrincipal };

export class MemoryAccessService {
  private readonly store: MemoryStore; private readonly vectorStore: VectorStore; private readonly embedder: Embedder; private readonly scopeGuard: ScopeGuard; private readonly events: MemoryEventPublisher; private readonly clock: Clock;
  constructor(options: MemoryAccessServiceOptions) { this.store = options.store; this.vectorStore = options.vectorStore; this.embedder = options.embedder ?? createDeterministicEmbedder(); this.scopeGuard = options.scopeGuard ?? createScopeGuard(); this.events = options.events ?? createNoopMemoryEventPublisher(); this.clock = options.clock ?? systemClock; }

  async create(input: CreateMemoryInput): Promise<MemoryContract> {
    const now = this.clock.nowIso();
    const memory = parseContract(MemoryContractSchema, { ...input.memory, id: input.memory.memoryId, schemaVersion: SCHEMA_VERSION, createdAt: now, updatedAt: now, metadata: input.memory.metadata ?? { labels: {}, annotations: {} } });
    assertPrincipalWrite(input.principal);
    if (input.memory.tenantId && input.principal.tenantId && input.principal.tenantId !== input.memory.tenantId) throw new MemoryAccessError('ACCESS_DENIED', `Tenant ${input.principal.tenantId} cannot write tenant ${input.memory.tenantId}`);
    await this.store.save(memory);
    const embedding = await this.embedder.embed(input.content);
    await this.vectorStore.upsert({ chunkId: `${memory.memoryId}:0`, memoryId: memory.memoryId, text: input.content, embedding, memoryKind: memory.memoryKind, tenantId: memory.tenantId });
    return memory;
  }

  async get(memoryId: string, principal: MemoryAccessPrincipal): Promise<MemoryContract> {
    const memory = await this.store.get(memoryId);
    if (!memory) throw new MemoryAccessError('NOT_FOUND', `Memory ${memoryId} not found`);
    this.scopeGuard.assertAllowed(principal, 'read', memory.scope, memory.tenantId);
    return memory;
  }

  async delete(memoryId: string, principal: MemoryAccessPrincipal, correlationId: string): Promise<boolean> {
    const memory = await this.store.get(memoryId);
    if (!memory) throw new MemoryAccessError('NOT_FOUND', `Memory ${memoryId} not found`);
    this.scopeGuard.assertAllowed(principal, 'write', memory.scope, memory.tenantId);
    const deleted = await this.store.delete(memoryId);
    if (deleted) {
      await this.vectorStore.deleteByMemoryId(memoryId);
      await this.events.publish('memory.deleted', correlationId, { memoryId, principalId: principal.principalId });
    }
    return deleted;
  }

  async retrieve(request: RetrievalRequest, principal: MemoryAccessPrincipal, correlationId: string): Promise<RetrievalBundle> {
    const requestId = randomUUID();
    await this.events.publish('memory.retrieve.requested', correlationId, { requestId, query: request.query, principalId: principal.principalId });
    try {
      const embedding = request.embedding ?? (await this.embedder.embed(request.query));
      const vectorResults = await this.vectorStore.search(embedding, { limit: (request.limit ?? 5) * 3 });
      const citations: RetrievalCitation[] = [];
      for (const result of vectorResults) {
        const memory = await this.store.get(result.chunk.memoryId); if (!memory) continue;
        if (request.tenantId && memory.tenantId && memory.tenantId !== request.tenantId) continue;
        if (request.memoryKinds && !request.memoryKinds.includes(memory.memoryKind)) continue;
        try { this.scopeGuard.assertAllowed(principal, 'read', memory.scope, memory.tenantId); } catch { continue; }
        citations.push({ memoryId: memory.memoryId, memoryKind: memory.memoryKind, title: memory.title, contentRef: memory.contentRef, score: result.score });
        if (citations.length >= (request.limit ?? 5)) break;
      }
      const bundle: RetrievalBundle = { requestId, query: request.query, citations, retrievedAt: this.clock.nowIso() };
      if (citations.length === 0) await this.events.publish('memory.citation.missing', correlationId, { requestId, query: request.query });
      await this.events.publish('memory.retrieve.completed', correlationId, { requestId, citationCount: citations.length });
      return bundle;
    } catch (err) {
      if (err instanceof MemoryAccessError && err.code === 'ACCESS_DENIED') await this.events.publish('memory.retrieve.denied', correlationId, { requestId, reason: err.message });
      throw err;
    }
  }

  async writeback(input: CreateMemoryInput, correlationId: string): Promise<WritebackReceipt> {
    const receiptId = randomUUID();
    try {
      this.scopeGuard.assertAllowed(input.principal, 'write', input.memory.scope, input.memory.tenantId);
      await this.events.publish('memory.writeback.queued', correlationId, { receiptId, memoryId: input.memory.memoryId });
      const memory = await this.create(input);
      await this.events.publish('memory.writeback.acked', correlationId, { receiptId, memoryId: memory.memoryId });
      return { receiptId, memoryId: memory.memoryId, status: 'acked' };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      await this.events.publish('memory.writeback.queued', correlationId, { receiptId, memoryId: input.memory.memoryId, denied: true });
      return { receiptId, memoryId: input.memory.memoryId, status: 'denied', reason };
    }
  }
}
