import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import { parseContract, SCHEMA_VERSION, ArtifactContractSchema, type ArtifactContract } from '@umer/contracts';
import { InMemoryArtifactStore } from '@umer/artifacts';
import { createControlApiServer, createControlApiState } from './server.js';

async function request(server: Server, path: string): Promise<{ status: number; json: unknown }> {
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('server not listening');
  }
  const response = await fetch(`http://127.0.0.1:${address.port}${path}`);
  return { status: response.status, json: await response.json() };
}

function sampleArtifact(overrides: Record<string, unknown> = {}): ArtifactContract {
  return parseContract(ArtifactContractSchema, {
    id: 'art-route-1',
    schemaVersion: SCHEMA_VERSION,
    createdAt: '2026-09-03T00:00:00.000Z',
    updatedAt: '2026-09-03T00:00:00.000Z',
    metadata: { labels: {}, annotations: {} },
    kind: 'artifact',
    artifactId: 'art-route-1',
    artifactType: 'ResearchFinding',
    version: 'v1',
    producedBy: 'growth.opportunity-research',
    producedFor: 'EXEC-1',
    acceptanceStatus: 'accepted',
    acceptanceCriteriaMet: [],
    sourceTaskId: 'task-1',
    contentRef: 'memory://art-route-1',
    ...overrides,
  });
}

describe('control-api /v1/artifacts', () => {
  let server: Server;

  beforeAll(async () => {
    const state = await createControlApiState();
    state.artifactStore = new InMemoryArtifactStore();
    await state.artifactStore.save(sampleArtifact());
    await state.artifactStore.save(sampleArtifact({ id: 'art-route-2', artifactId: 'art-route-2', producedFor: 'EXEC-2' }));
    server = createControlApiServer(state);
    await new Promise<void>((resolve) => server.listen(0, resolve));
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  });

  it('lists every known artifact', async () => {
    const { status, json } = await request(server, '/v1/artifacts');
    expect(status).toBe(200);
    const body = json as { artifacts: ArtifactContract[] };
    expect(body.artifacts.map((a) => a.artifactId).sort()).toEqual(['art-route-1', 'art-route-2']);
  });

  it('filters by execId', async () => {
    const { json } = await request(server, '/v1/artifacts?execId=EXEC-2');
    const body = json as { artifacts: ArtifactContract[] };
    expect(body.artifacts).toHaveLength(1);
    expect(body.artifacts[0]?.artifactId).toBe('art-route-2');
  });

  it('returns a single artifact', async () => {
    const { status, json } = await request(server, '/v1/artifacts/art-route-1');
    expect(status).toBe(200);
    const artifact = json as ArtifactContract;
    expect(artifact.acceptanceStatus).toBe('accepted');
    expect(artifact.sourceTaskId).toBe('task-1');
  });

  it('404s for an unknown artifact', async () => {
    const { status } = await request(server, '/v1/artifacts/does-not-exist');
    expect(status).toBe(404);
  });
});
