import type { GateWaitRecord, GateWaitStatus } from './types.js';
import type { GateWaitStore } from './store.js';

/**
 * MySQL adapter contract — intentionally injected (structural, not a driver
 * import) so this package never depends on a specific MySQL client. Matches
 * @umer/opportunity-intelligence's / @umer/orchestration's MySqlExecutor
 * shape; a real caller wires this to @umer/db's createMySqlExecutor().
 */
export type MySqlExecutor = {
  execute<T = unknown>(sql: string, params?: readonly unknown[]): Promise<T>;
};

export type MySqlGateWaitStoreOptions = {
  db: MySqlExecutor;
};

type GateWaitRow = {
  wait_id: string;
  gate_id: string;
  exec_id: string;
  work_package_id: string;
  artifact_id: string | null;
  stage_from: string;
  stage_to: string;
  status: GateWaitStatus;
  required_approvers_json: string | string[];
  recorded_approvers_json: string | string[];
  human_required: number | boolean;
  requested_at: string;
  resolved_at: string | null;
  rationale: string | null;
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

function rowToRecord(row: GateWaitRow): GateWaitRecord {
  return {
    waitId: row.wait_id,
    gateId: row.gate_id,
    execId: row.exec_id,
    workPackageId: row.work_package_id,
    artifactId: row.artifact_id ?? undefined,
    stageFrom: row.stage_from,
    stageTo: row.stage_to,
    status: row.status,
    requiredApprovers: parseJsonColumn(row.required_approvers_json),
    recordedApprovers: parseJsonColumn(row.recorded_approvers_json),
    humanRequired: Boolean(row.human_required),
    requestedAt: toIso(row.requested_at),
    resolvedAt: row.resolved_at ? toIso(row.resolved_at) : undefined,
    rationale: row.rationale ?? undefined,
  };
}

/**
 * MySQL-backed GateWaitStore — see packages/db's gate-wait-migration.ts for
 * the `control_plane_gate_waits` schema. Every write is an upsert keyed by
 * wait_id, matching how ControlPlaneService always calls save() with the
 * full current record (never a partial patch).
 */
export class MySqlGateWaitStore implements GateWaitStore {
  constructor(private readonly options: MySqlGateWaitStoreOptions) {}

  async save(record: GateWaitRecord): Promise<void> {
    await this.options.db.execute(
      `INSERT INTO control_plane_gate_waits (
         wait_id, gate_id, exec_id, work_package_id, artifact_id, stage_from, stage_to,
         status, required_approvers_json, recorded_approvers_json, human_required,
         requested_at, resolved_at, rationale
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         gate_id=VALUES(gate_id), exec_id=VALUES(exec_id), work_package_id=VALUES(work_package_id),
         artifact_id=VALUES(artifact_id), stage_from=VALUES(stage_from), stage_to=VALUES(stage_to),
         status=VALUES(status), required_approvers_json=VALUES(required_approvers_json),
         recorded_approvers_json=VALUES(recorded_approvers_json), human_required=VALUES(human_required),
         resolved_at=VALUES(resolved_at), rationale=VALUES(rationale)`,
      [
        record.waitId,
        record.gateId,
        record.execId,
        record.workPackageId,
        record.artifactId ?? null,
        record.stageFrom,
        record.stageTo,
        record.status,
        JSON.stringify(record.requiredApprovers),
        JSON.stringify(record.recordedApprovers),
        record.humanRequired ? 1 : 0,
        toMySqlDateTime(record.requestedAt),
        record.resolvedAt ? toMySqlDateTime(record.resolvedAt) : null,
        record.rationale ?? null,
      ],
    );
  }

  async get(waitId: string): Promise<GateWaitRecord | undefined> {
    const rows = await this.options.db.execute<GateWaitRow[]>(
      'SELECT * FROM control_plane_gate_waits WHERE wait_id = ? LIMIT 1',
      [waitId],
    );
    return rows[0] ? rowToRecord(rows[0]) : undefined;
  }

  async list(): Promise<GateWaitRecord[]> {
    const rows = await this.options.db.execute<GateWaitRow[]>(
      'SELECT * FROM control_plane_gate_waits ORDER BY requested_at DESC',
    );
    return rows.map(rowToRecord);
  }

  async listPending(): Promise<GateWaitRecord[]> {
    const rows = await this.options.db.execute<GateWaitRow[]>(
      "SELECT * FROM control_plane_gate_waits WHERE status = 'waiting' ORDER BY requested_at ASC",
    );
    return rows.map(rowToRecord);
  }
}
