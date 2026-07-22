import { describe, expect, it, vi } from 'vitest';
import type { RuntimeEventName } from '@umer/contracts';
import { parseContract, SCHEMA_VERSION, ArtifactContractSchema } from '@umer/contracts';
import {
  ArtifactEngineError,
  createArtifactStack,
  sealArtifact,
  validateArtifact,
} from './index.js';

function sampleArtifact(overrides: Record<string, unknown> = {}) {
  return parseContract(ArtifactContractSchema, {
    id: 'art-1',
    schemaVersion: SCHEMA_VERSION,
    createdAt: '2026-07-22T00:00:00.000Z',
    updatedAt: '2026-07-22T00:00:00.000Z',
    metadata: { labels: {}, annotations: {} },
    kind: 'artifact',
    artifactId: 'art-1',
    artifactType: 'Code',
    version: 'v1',
    producedBy: 'eng.app-delivery',
    producedFor: 'EXEC-001',
    acceptanceStatus: 'draft',
    acceptanceCriteriaMet: [
      {
        criterion: 'Task task-1 delivery evidence',
        status: 'VERIFIED',
        evidenceRef: 'mem://runs/wp-1',
      },
    ],
    sourceTaskId: 'task-1',
    contentRef: 'memory://art-1',
    ...overrides,
  });
}

describe('artifacts engine', () => {
  it('seals artifact into store', async () => {
    const { engine, store } = createArtifactStack();
    const sealed = await engine.seal(sampleArtifact(), 'corr-seal');
    expect(sealed.acceptanceStatus).toBe('submitted');
    expect(await store.get('art-1')).toBeDefined();
    expect(engine.getSealRecord('art-1')?.contentHash).toBeTruthy();
  });

  it('legacy sealArtifact helper seals via engine', async () => {
    const { store } = createArtifactStack();
    const sealed = await sealArtifact(sampleArtifact(), store);
    expect(sealed.acceptanceStatus).toBe('submitted');
  });

  it('prevents modifying sealed artifacts', async () => {
    const { engine, store } = createArtifactStack();
    await engine.seal(sampleArtifact(), 'corr-seal');
    await expect(
      store.save({ ...(await store.get('art-1'))!, acceptanceStatus: 'draft' }),
    ).rejects.toMatchObject({ code: 'SEAL_VIOLATION' });
  });

  it('validates required acceptance criteria from task', () => {
    const valid = validateArtifact(sampleArtifact(), {
      requiredCriteria: ['Task task-1 delivery evidence'],
    });
    expect(valid.valid).toBe(true);

    const missing = validateArtifact(sampleArtifact({ acceptanceCriteriaMet: [] }), {
      requiredCriteria: ['Task task-1 delivery evidence'],
    });
    expect(missing.valid).toBe(false);
    expect(missing.issues[0]?.code).toBe('MISSING_CRITERION');
  });

  it('rejects invented criteria not in source task', () => {
    const invented = validateArtifact(
      sampleArtifact({
        acceptanceCriteriaMet: [
          {
            criterion: 'Task task-1 delivery evidence',
            status: 'VERIFIED',
            evidenceRef: 'mem://runs/wp-1',
          },
          { criterion: 'Invented at validation time', status: 'VERIFIED', evidenceRef: 'x' },
        ],
      }),
      { requiredCriteria: ['Task task-1 delivery evidence'] },
    );
    expect(invented.valid).toBe(false);
    expect(invented.issues.some((issue) => issue.code === 'INVENTED_CRITERION')).toBe(true);
  });

  it('creates transfer package for sealed artifacts', async () => {
    const { engine } = createArtifactStack();
    await engine.seal(sampleArtifact(), 'corr-seal');
    const transfer = await engine.createTransfer({
      execId: 'EXEC-001',
      fromProducer: 'eng.app-delivery',
      toConsumer: 'qa.review',
      artifactIds: ['art-1'],
      correlationId: 'corr-transfer',
    });
    expect(transfer.artifactIds).toEqual(['art-1']);
    const receipt = await engine.acknowledgeTransfer(transfer.transferId, 'corr-transfer');
    expect(receipt.status).toBe('delivered');
  });

  it('supersedes artifact with lineage', async () => {
    const { engine } = createArtifactStack();
    await engine.seal(sampleArtifact(), 'corr-seal');
    const next = sampleArtifact({
      id: 'art-2',
      artifactId: 'art-2',
      version: 'v2',
      acceptanceStatus: 'draft',
    });
    const result = await engine.supersede('art-1', next, 'corr-supersede');
    expect(result.nextArtifactId).toBe('art-2');
    const lineage = await engine.getLineage('art-2');
    expect(lineage.map((artifact) => artifact.artifactId)).toEqual(['art-1', 'art-2']);
  });

  it('emits runtime events', async () => {
    const published: RuntimeEventName[] = [];
    const stack = createArtifactStack();
    const engineWithEvents = new (await import('./engine.js')).ArtifactEngine({
      store: stack.store,
      events: {
        publish: vi.fn(async (name: RuntimeEventName) => {
          published.push(name);
        }),
      },
    });
    await engineWithEvents.seal(sampleArtifact(), 'corr-events');
    expect(published).toContain('artifact.sealed');
  });

  it('throws when superseding with same artifact id', async () => {
    const { engine } = createArtifactStack();
    await engine.seal(sampleArtifact(), 'corr-seal');
    await expect(engine.supersede('art-1', sampleArtifact(), 'corr-bad')).rejects.toThrow(
      ArtifactEngineError,
    );
  });
});
