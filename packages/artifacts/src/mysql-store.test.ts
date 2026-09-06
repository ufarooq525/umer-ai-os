import { describe, expect, it, vi } from 'vitest';
import { SCHEMA_VERSION, type ArtifactContract } from '@umer/contracts';
import { MySqlArtifactStore, type MySqlExecutor } from './mysql-store.js';
import { ArtifactEngineError } from './errors.js';

function draftArtifact(overrides: Partial<ArtifactContract> = {}): ArtifactContract {
  return {
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
    acceptanceStatus: 'draft',
    acceptanceCriteriaMet: [],
    contentRef: 'memory://artifacts/art-1',
    ...overrides,
  };
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    artifact_id: 'art-1',
    header_id: 'art-hdr-1',
    artifact_type: 'ResearchFinding',
    version: 'wp-1:1',
    produced_by: 'growth.opportunity-research',
    produced_for: 'EXEC-1',
    acceptance_status: 'submitted',
    acceptance_criteria_met_json: JSON.stringify([]),
    source_task_id: null,
    content_ref: 'memory://artifacts/art-1',
    content_hash: null,
    supersedes_artifact_id: null,
    metadata_json: JSON.stringify({ labels: {}, annotations: {} }),
    created_at: '2026-09-06T00:00:00.000Z',
    updated_at: '2026-09-06T00:00:00.000Z',
    ...overrides,
  };
}

describe('MySqlArtifactStore', () => {
  it('maps a row back to a valid artifact', async () => {
    const execute = vi.fn<MySqlExecutor['execute']>(async () => [row()] as never);
    const store = new MySqlArtifactStore({ db: { execute: execute as unknown as MySqlExecutor['execute'] } });

    const artifact = await store.get('art-1');

    expect(artifact).toMatchObject({
      artifactId: 'art-1',
      producedFor: 'EXEC-1',
      acceptanceStatus: 'submitted',
    });
  });

  it('returns undefined when no row matches', async () => {
    const execute = vi.fn<MySqlExecutor['execute']>(async () => [] as never);
    const store = new MySqlArtifactStore({ db: { execute: execute as unknown as MySqlExecutor['execute'] } });
    expect(await store.get('missing')).toBeUndefined();
  });

  it('saves a draft artifact', async () => {
    const execute = vi.fn<MySqlExecutor['execute']>(async () => [] as never);
    const store = new MySqlArtifactStore({ db: { execute: execute as unknown as MySqlExecutor['execute'] } });

    await store.save(draftArtifact());

    const insertCall = execute.mock.calls.find(([sql]) => sql.includes('INSERT INTO'));
    expect(insertCall).toBeDefined();
    expect(insertCall![0]).toContain('ON DUPLICATE KEY UPDATE');
  });

  it('rejects overwriting an already-sealed (submitted) artifact', async () => {
    const execute = vi.fn<MySqlExecutor['execute']>(async () => [row({ acceptance_status: 'submitted' })] as never);
    const store = new MySqlArtifactStore({ db: { execute: execute as unknown as MySqlExecutor['execute'] } });

    await expect(store.save(draftArtifact())).rejects.toThrow(ArtifactEngineError);
  });

  it('allows overwriting a draft (not yet sealed) artifact', async () => {
    const execute = vi.fn<MySqlExecutor['execute']>(async () => [row({ acceptance_status: 'draft' })] as never);
    const store = new MySqlArtifactStore({ db: { execute: execute as unknown as MySqlExecutor['execute'] } });

    await expect(store.save(draftArtifact())).resolves.toBeUndefined();
  });

  it('filters listByExecId to only the requested execId', async () => {
    const execute = vi.fn<MySqlExecutor['execute']>(async () => [] as never);
    const store = new MySqlArtifactStore({ db: { execute: execute as unknown as MySqlExecutor['execute'] } });

    await store.listByExecId('EXEC-1');

    const [sql, params] = execute.mock.calls[0]!;
    expect(sql).toContain('WHERE produced_for = ?');
    expect(params).toEqual(['EXEC-1']);
  });
});
