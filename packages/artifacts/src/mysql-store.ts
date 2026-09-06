import { parseContract, SCHEMA_VERSION, ArtifactContractSchema } from '@umer/contracts';
import type { ArtifactContract } from '@umer/contracts';
import { ArtifactEngineError } from './errors.js';
import { isArtifactImmutable } from './hash.js';
import type { ArtifactStore } from './store.js';

/**
 * MySQL adapter contract — intentionally injected (structural, not a driver
 * import), matching the MySqlExecutor shape used across this codebase.
 */
export type MySqlExecutor = {
  execute<T = unknown>(sql: string, params?: readonly unknown[]): Promise<T>;
};

export type MySqlArtifactStoreOptions = {
  db: MySqlExecutor;
};

type ArtifactRow = {
  artifact_id: string;
  header_id: string;
  artifact_type: string;
  version: string;
  produced_by: string;
  produced_for: string;
  acceptance_status: string;
  acceptance_criteria_met_json: string | Record<string, unknown>[];
  source_task_id: string | null;
  content_ref: string;
  content_hash: string | null;
  supersedes_artifact_id: string | null;
  metadata_json: string | Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

function toIso(value: string | Date): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function toMySqlDateTime(iso: string): string {
  return new Date(iso).toISOString().slice(0, 23).replace('T', ' ');
}

function parseJsonColumn<T>(value: string | T): T {
  return typeof value === 'string' ? (JSON.parse(value) as T) : value;
}

function rowToArtifact(row: ArtifactRow): ArtifactContract {
  return parseContract(ArtifactContractSchema, {
    id: row.header_id,
    schemaVersion: SCHEMA_VERSION,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    metadata: parseJsonColumn(row.metadata_json),
    kind: 'artifact',
    artifactId: row.artifact_id,
    artifactType: row.artifact_type,
    version: row.version,
    producedBy: row.produced_by,
    producedFor: row.produced_for,
    acceptanceStatus: row.acceptance_status,
    acceptanceCriteriaMet: parseJsonColumn(row.acceptance_criteria_met_json),
    ...(row.source_task_id ? { sourceTaskId: row.source_task_id } : {}),
    contentRef: row.content_ref,
    ...(row.content_hash ? { contentHash: row.content_hash } : {}),
    ...(row.supersedes_artifact_id ? { supersedesArtifactId: row.supersedes_artifact_id } : {}),
  });
}

/**
 * MySQL-backed ArtifactStore — see packages/db's artifact-migration.ts for
 * the `artifact_runtime_artifacts` schema. Preserves the same seal-immutability
 * guard as InMemoryArtifactStore: a `submitted`/`accepted` artifact cannot be
 * overwritten.
 */
export class MySqlArtifactStore implements ArtifactStore {
  constructor(private readonly options: MySqlArtifactStoreOptions) {}

  async save(artifact: ArtifactContract): Promise<void> {
    const existing = await this.get(artifact.artifactId);
    if (existing && isArtifactImmutable(existing)) {
      throw new ArtifactEngineError(
        'SEAL_VIOLATION',
        `Artifact ${artifact.artifactId} is sealed and cannot be modified`,
      );
    }
    await this.options.db.execute(
      `INSERT INTO artifact_runtime_artifacts (
         artifact_id, header_id, artifact_type, version, produced_by, produced_for,
         acceptance_status, acceptance_criteria_met_json, source_task_id, content_ref,
         content_hash, supersedes_artifact_id, metadata_json, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         header_id=VALUES(header_id), artifact_type=VALUES(artifact_type), version=VALUES(version),
         produced_by=VALUES(produced_by), produced_for=VALUES(produced_for),
         acceptance_status=VALUES(acceptance_status),
         acceptance_criteria_met_json=VALUES(acceptance_criteria_met_json),
         source_task_id=VALUES(source_task_id), content_ref=VALUES(content_ref),
         content_hash=VALUES(content_hash), supersedes_artifact_id=VALUES(supersedes_artifact_id),
         metadata_json=VALUES(metadata_json), updated_at=VALUES(updated_at)`,
      [
        artifact.artifactId,
        artifact.id,
        artifact.artifactType,
        artifact.version,
        artifact.producedBy,
        artifact.producedFor,
        artifact.acceptanceStatus,
        JSON.stringify(artifact.acceptanceCriteriaMet),
        artifact.sourceTaskId ?? null,
        artifact.contentRef,
        artifact.contentHash ?? null,
        artifact.supersedesArtifactId ?? null,
        JSON.stringify(artifact.metadata),
        toMySqlDateTime(artifact.createdAt),
        toMySqlDateTime(artifact.updatedAt),
      ],
    );
  }

  async get(artifactId: string): Promise<ArtifactContract | undefined> {
    const rows = await this.options.db.execute<ArtifactRow[]>(
      'SELECT * FROM artifact_runtime_artifacts WHERE artifact_id = ? LIMIT 1',
      [artifactId],
    );
    return rows[0] ? rowToArtifact(rows[0]) : undefined;
  }

  async list(): Promise<ArtifactContract[]> {
    const rows = await this.options.db.execute<ArtifactRow[]>(
      'SELECT * FROM artifact_runtime_artifacts ORDER BY created_at DESC',
    );
    return rows.map(rowToArtifact);
  }

  async listByExecId(execId: string): Promise<ArtifactContract[]> {
    const rows = await this.options.db.execute<ArtifactRow[]>(
      'SELECT * FROM artifact_runtime_artifacts WHERE produced_for = ? ORDER BY created_at DESC',
      [execId],
    );
    return rows.map(rowToArtifact);
  }
}
