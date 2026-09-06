import { parseContract, SCHEMA_VERSION, WorkPackageContractSchema } from '@umer/contracts';
import type { WorkPackageContract, WorkPackageStatus } from '@umer/contracts';
import type { WorkPackageRecord, WorkPackageStore } from './store.js';

/**
 * MySQL adapter contract — intentionally injected (structural, not a driver
 * import), matching the same MySqlExecutor shape used across this codebase
 * (@umer/opportunity-intelligence, @umer/control-plane, this package's own
 * work-graph-mysql-store.ts).
 */
export type MySqlExecutor = {
  execute<T = unknown>(sql: string, params?: readonly unknown[]): Promise<T>;
};

export type MySqlWorkPackageStoreOptions = {
  db: MySqlExecutor;
};

type WorkPackageRow = {
  work_package_id: string;
  header_id: string;
  exec_id: string;
  stage: string;
  status: WorkPackageStatus;
  specialist_id: string;
  specialist_spec_version: string;
  specialist_spec_hash: string;
  task_ids_json: string | string[];
  capability_ids_json: string | string[];
  context_handle: string;
  tool_allowlist_json: string | string[];
  resource_envelope_json: string | Record<string, unknown>;
  attempt: number;
  parent_work_package_id: string | null;
  correlation_id: string | null;
  metadata_json: string | Record<string, unknown>;
  created_at: string;
  updated_at: string;
  queued_at: string | null;
  dispatched_at: string | null;
  started_at: string | null;
  last_error: string | null;
  target_path: string | null;
};

function toIso(value: string | Date): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function toMySqlDateTime(iso: string): string {
  return new Date(iso).toISOString().slice(0, 23).replace('T', ' ');
}

function toMySqlDateTimeOrNull(iso?: string): string | null {
  return iso ? toMySqlDateTime(iso) : null;
}

function parseJsonColumn<T>(value: string | T): T {
  return typeof value === 'string' ? (JSON.parse(value) as T) : value;
}

function rowToRecord(row: WorkPackageRow): WorkPackageRecord {
  const workPackage: WorkPackageContract = parseContract(WorkPackageContractSchema, {
    id: row.header_id,
    schemaVersion: SCHEMA_VERSION,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    metadata: parseJsonColumn(row.metadata_json),
    kind: 'work_package',
    workPackageId: row.work_package_id,
    execId: row.exec_id,
    stage: row.stage,
    status: row.status,
    specialistId: row.specialist_id,
    specialistSpecVersion: row.specialist_spec_version,
    specialistSpecHash: row.specialist_spec_hash,
    taskIds: parseJsonColumn(row.task_ids_json),
    capabilityIds: parseJsonColumn(row.capability_ids_json),
    contextHandle: row.context_handle,
    toolAllowlist: parseJsonColumn(row.tool_allowlist_json),
    resourceEnvelope: parseJsonColumn(row.resource_envelope_json),
    attempt: row.attempt,
    ...(row.parent_work_package_id ? { parentWorkPackageId: row.parent_work_package_id } : {}),
    ...(row.correlation_id ? { correlationId: row.correlation_id } : {}),
    ...(row.target_path ? { targetPath: row.target_path } : {}),
  });

  return {
    workPackage,
    queuedAt: row.queued_at ? toIso(row.queued_at) : undefined,
    dispatchedAt: row.dispatched_at ? toIso(row.dispatched_at) : undefined,
    startedAt: row.started_at ? toIso(row.started_at) : undefined,
    lastError: row.last_error ?? undefined,
  };
}

/**
 * MySQL-backed WorkPackageStore — the Orchestrator's own authoritative Work
 * Package records (see packages/db's work-package-migration.ts for the
 * `orchestration_work_packages` schema). Every write is an upsert keyed by
 * work_package_id, matching how the Orchestrator always calls save() with
 * the full current record.
 */
export class MySqlWorkPackageStore implements WorkPackageStore {
  constructor(private readonly options: MySqlWorkPackageStoreOptions) {}

  async get(workPackageId: string): Promise<WorkPackageRecord | undefined> {
    const rows = await this.options.db.execute<WorkPackageRow[]>(
      'SELECT * FROM orchestration_work_packages WHERE work_package_id = ? LIMIT 1',
      [workPackageId],
    );
    return rows[0] ? rowToRecord(rows[0]) : undefined;
  }

  async save(record: WorkPackageRecord): Promise<void> {
    const wp = record.workPackage;
    await this.options.db.execute(
      `INSERT INTO orchestration_work_packages (
         work_package_id, header_id, exec_id, stage, status, specialist_id,
         specialist_spec_version, specialist_spec_hash, task_ids_json, capability_ids_json,
         context_handle, tool_allowlist_json, resource_envelope_json, attempt,
         parent_work_package_id, correlation_id, metadata_json,
         created_at, updated_at, queued_at, dispatched_at, started_at, last_error, target_path
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         header_id=VALUES(header_id), exec_id=VALUES(exec_id), stage=VALUES(stage), status=VALUES(status),
         specialist_id=VALUES(specialist_id), specialist_spec_version=VALUES(specialist_spec_version),
         specialist_spec_hash=VALUES(specialist_spec_hash), task_ids_json=VALUES(task_ids_json),
         capability_ids_json=VALUES(capability_ids_json), context_handle=VALUES(context_handle),
         tool_allowlist_json=VALUES(tool_allowlist_json), resource_envelope_json=VALUES(resource_envelope_json),
         attempt=VALUES(attempt), parent_work_package_id=VALUES(parent_work_package_id),
         correlation_id=VALUES(correlation_id), metadata_json=VALUES(metadata_json),
         updated_at=VALUES(updated_at), queued_at=VALUES(queued_at), dispatched_at=VALUES(dispatched_at),
         started_at=VALUES(started_at), last_error=VALUES(last_error), target_path=VALUES(target_path)`,
      [
        wp.workPackageId,
        wp.id,
        wp.execId,
        wp.stage,
        wp.status,
        wp.specialistId,
        wp.specialistSpecVersion,
        wp.specialistSpecHash,
        JSON.stringify(wp.taskIds),
        JSON.stringify(wp.capabilityIds),
        wp.contextHandle,
        JSON.stringify(wp.toolAllowlist),
        JSON.stringify(wp.resourceEnvelope),
        wp.attempt,
        wp.parentWorkPackageId ?? null,
        wp.correlationId ?? null,
        JSON.stringify(wp.metadata),
        toMySqlDateTime(wp.createdAt),
        toMySqlDateTime(wp.updatedAt),
        toMySqlDateTimeOrNull(record.queuedAt),
        toMySqlDateTimeOrNull(record.dispatchedAt),
        toMySqlDateTimeOrNull(record.startedAt),
        record.lastError ?? null,
        wp.targetPath ?? null,
      ],
    );
  }

  async listByStatus(status: WorkPackageStatus): Promise<WorkPackageRecord[]> {
    const rows = await this.options.db.execute<WorkPackageRow[]>(
      'SELECT * FROM orchestration_work_packages WHERE status = ?',
      [status],
    );
    return rows.map(rowToRecord);
  }
}
