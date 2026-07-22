import { describe, expect, it, vi } from 'vitest';
import type { RuntimeEventName } from '@umer/contracts';
import {
  MemoryAccessError,
  createMemoryStack,
  createScopeGuard,
  cosineSimilarity,
  createDeterministicEmbedder,
  type MemoryAccessPrincipal,
} from './index.js';

const reader: MemoryAccessPrincipal = {
  principalId: 'spec-eng.app-delivery',
  grantedScopes: ['read'],
};

const writer: MemoryAccessPrincipal = {
  principalId: 'spec-eng.app-delivery',
  grantedScopes: ['read_write'],
};

const lessonInput = {
  memory: {
    kind: 'memory' as const,
    memoryId: 'mem-lesson-1',
    memoryKind: 'Lesson' as const,
    scope: 'read' as const,
    title: 'Application delivery handoff ack required',
    contentRef: 'intel://lessons/handoff-ack',
    tags: ['handoff', 'engineering'],
    retentionClass: 'durable' as const,
    metadata: { labels: {}, annotations: {} },
  },
  content:
    'Always require explicit handoff acknowledgment before closing application delivery work packages.',
};

describe('memory-access', () => {
  it('creates and retrieves memory records', async () => {
    const { service } = createMemoryStack();
    const memory = await service.create({ ...lessonInput, principal: writer });
    expect(memory.memoryId).toBe('mem-lesson-1');

    const fetched = await service.get('mem-lesson-1', reader);
    expect(fetched.title).toContain('handoff');
  });

  it('denies read when principal lacks scope', async () => {
    const { service } = createMemoryStack();
    await service.create({ ...lessonInput, principal: writer });
    const deniedReader: MemoryAccessPrincipal = {
      principalId: 'other',
      grantedScopes: ['write'],
    };
    await expect(service.get('mem-lesson-1', deniedReader)).rejects.toMatchObject({
      code: 'ACCESS_DENIED',
    });
  });

  it('retrieves citations for a semantic query', async () => {
    const { service } = createMemoryStack();
    await service.create({ ...lessonInput, principal: writer });

    const bundle = await service.retrieve(
      { query: 'application delivery handoff acknowledgment', memoryKinds: ['Lesson'], limit: 3 },
      reader,
      'corr-mem-1',
    );

    expect(bundle.citations.length).toBeGreaterThan(0);
    expect(bundle.citations[0]?.memoryId).toBe('mem-lesson-1');
    expect(bundle.citations[0]?.contentRef).toContain('intel://');
  });

  it('emits citation.missing when no matches', async () => {
    const published: RuntimeEventName[] = [];
    const scoped = createMemoryStack();
    const memoryService = new (await import('./service.js')).MemoryAccessService({
      store: scoped.store,
      vectorStore: scoped.vectorStore,
      events: {
        publish: vi.fn(async (name: RuntimeEventName) => {
          published.push(name);
        }),
      },
    });

    await memoryService.retrieve(
      { query: 'unrelated quantum finance topic' },
      reader,
      'corr-empty',
    );

    expect(published).toContain('memory.retrieve.requested');
    expect(published).toContain('memory.citation.missing');
    expect(published).toContain('memory.retrieve.completed');
  });

  it('writeback queues and acknowledges durable memories', async () => {
    const { service } = createMemoryStack();
    const receipt = await service.writeback(
      {
        memory: {
          kind: 'memory',
          memoryId: 'mem-run-1',
          memoryKind: 'WorkingNote',
          scope: 'read_write',
          title: 'Run summary wp-1',
          contentRef: 'intel://runs/wp-1',
          tags: ['run-summary'],
          retentionClass: 'ephemeral',
          metadata: { labels: {}, annotations: {} },
        },
        content: 'Completed engineering delivery for wp-1.',
        principal: writer,
      },
      'corr-writeback',
    );

    expect(receipt.status).toBe('acked');
    expect(await service.get('mem-run-1', reader)).toBeDefined();
  });

  it('writeback denies when scope guard blocks write', async () => {
    const { service } = createMemoryStack();
    const receipt = await service.writeback(
      {
        memory: {
          kind: 'memory',
          memoryId: 'mem-run-denied',
          memoryKind: 'WorkingNote',
          scope: 'read',
          title: 'Read-only note',
          contentRef: 'intel://runs/denied',
          tags: [],
          retentionClass: 'ephemeral',
          metadata: { labels: {}, annotations: {} },
        },
        content: 'Should not persist.',
        principal: writer,
      },
      'corr-denied',
    );

    expect(receipt.status).toBe('denied');
    expect(receipt.reason).toBeDefined();
  });

  it('computes cosine similarity', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('uses deterministic embedder dimensions', async () => {
    const embedder = createDeterministicEmbedder(8);
    const left = await embedder.embed('application delivery');
    const right = await embedder.embed('application delivery');
    expect(left).toHaveLength(8);
    expect(left).toEqual(right);
  });

  it('enforces tenant boundaries via scope guard', () => {
    const guard = createScopeGuard();
    expect(() =>
      guard.assertAllowed(
        { principalId: 'a', grantedScopes: ['read'], tenantId: 'tenant-a' },
        'read',
        'read',
        'tenant-b',
      ),
    ).toThrow(MemoryAccessError);
  });
});
