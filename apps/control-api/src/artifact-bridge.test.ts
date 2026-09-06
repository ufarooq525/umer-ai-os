import { describe, expect, it } from 'vitest';
import { ArtifactContractSchema, SCHEMA_VERSION, parseContract, type ArtifactContract } from '@umer/contracts';
import { createEventEnvelope } from '@umer/message-fabric';
import { createControlApiState } from './server.js';
import { projectArtifactSealedEvent } from './artifact-bridge.js';

function sealedArtifact(overrides: Record<string, unknown> = {}): ArtifactContract {
  return parseContract(ArtifactContractSchema, {
    id: 'art-hdr-1',
    schemaVersion: SCHEMA_VERSION,
    createdAt: '2026-09-06T00:00:00.000Z',
    updatedAt: '2026-09-06T00:00:00.000Z',
    metadata: { labels: {}, annotations: {} },
    kind: 'artifact',
    artifactId: 'art-1',
    artifactType: 'ResearchFinding',
    version: 'wp-1:1',
    producedBy: 'growth.opportunity-research',
    producedFor: 'EXEC-1',
    acceptanceStatus: 'submitted',
    acceptanceCriteriaMet: [],
    contentRef: 'memory://artifacts/art-1',
    ...overrides,
  });
}

describe('projectArtifactSealedEvent', () => {
  it('saves the real sealed artifact carried on the event into state.artifactStore', async () => {
    const state = await createControlApiState();
    const artifact = sealedArtifact();
    const event = createEventEnvelope({
      name: 'artifact.sealed',
      producer: 'agent-worker',
      correlationId: 'corr-1',
      payload: { workPackageId: 'wp-1', artifactId: 'art-1', artifactType: 'ResearchFinding', artifact },
    });

    await projectArtifactSealedEvent(state, event);

    const saved = await state.artifactStore!.get('art-1');
    expect(saved).toMatchObject({ artifactId: 'art-1', producedFor: 'EXEC-1', acceptanceStatus: 'submitted' });
  });

  it('does nothing when the event carries no full artifact (pre-fix / no ArtifactEngine configured)', async () => {
    const state = await createControlApiState();
    const event = createEventEnvelope({
      name: 'artifact.sealed',
      producer: 'agent-worker',
      correlationId: 'corr-1',
      payload: { workPackageId: 'wp-2', artifactId: 'art-2', artifactType: 'ResearchFinding' },
    });

    await projectArtifactSealedEvent(state, event);

    expect(await state.artifactStore!.get('art-2')).toBeUndefined();
  });

  it('makes a real sealed artifact visible via GET /v1/artifacts-style store reads (list + listByExecId)', async () => {
    const state = await createControlApiState();
    await projectArtifactSealedEvent(
      state,
      createEventEnvelope({
        name: 'artifact.sealed',
        producer: 'agent-worker',
        correlationId: 'corr-1',
        payload: { workPackageId: 'wp-1', artifact: sealedArtifact() },
      }),
    );

    expect(await state.artifactStore!.list()).toHaveLength(1);
    expect(await state.artifactStore!.listByExecId('EXEC-1')).toHaveLength(1);
    expect(await state.artifactStore!.listByExecId('EXEC-999')).toHaveLength(0);
  });
});
