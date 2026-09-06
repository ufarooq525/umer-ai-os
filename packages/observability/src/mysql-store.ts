import type {
  ActionLogEntry,
  AgentRunReadModelStore,
  AgentRunSnapshot,
  AgentRunStatus,
  DecisionRecord,
  FailureRecord,
  ToolCallRecord,
} from './agent-run-read-model.js';
import { projectRuntimeEvent } from './agent-run-read-model.js';
import type { AgentRegistryStore, AgentSnapshot, AgentSnapshotStatus } from './agent-registry.js';
import { projectAgentEvent } from './agent-registry.js';
import type { EventEnvelope } from '@umer/contracts';

/**
 * MySQL adapter contract — intentionally injected (structural, not a driver
 * import), matching the MySqlExecutor shape used across this codebase.
 */
export type MySqlExecutor = {
  execute<T = unknown>(sql: string, params?: readonly unknown[]): Promise<T>;
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

// --- Agent Run read model -----------------------------------------------

export type MySqlAgentRunReadModelStoreOptions = {
  db: MySqlExecutor;
};

type AgentRunRow = {
  work_package_id: string;
  run_id: string | null;
  exec_id: string | null;
  specialist_id: string | null;
  agent_id: string | null;
  task_ids_json: string | string[] | null;
  correlation_id: string;
  status: AgentRunStatus;
  current_action: AgentRunSnapshot['currentAction'];
  current_tool: string | null;
  current_tool_input_json: string | unknown;
  started_at: string;
  updated_at: string;
  finished_at: string | null;
  tool_calls_json: string | ToolCallRecord[];
  decisions_json: string | DecisionRecord[];
  action_log_json: string | ActionLogEntry[];
  failures_json: string | FailureRecord[];
  artifact_id: string | null;
  summary: string | null;
  error_message: string | null;
};

function rowToAgentRun(row: AgentRunRow): AgentRunSnapshot {
  return {
    workPackageId: row.work_package_id,
    ...(row.run_id ? { runId: row.run_id } : {}),
    ...(row.exec_id ? { execId: row.exec_id } : {}),
    ...(row.specialist_id ? { specialistId: row.specialist_id } : {}),
    ...(row.agent_id ? { agentId: row.agent_id } : {}),
    ...(row.task_ids_json ? { taskIds: parseJsonColumn(row.task_ids_json) } : {}),
    correlationId: row.correlation_id,
    status: row.status,
    currentAction: row.current_action,
    ...(row.current_tool ? { currentTool: row.current_tool } : {}),
    ...(row.current_tool_input_json != null ? { currentToolInput: parseJsonColumn(row.current_tool_input_json) } : {}),
    startedAt: toIso(row.started_at),
    updatedAt: toIso(row.updated_at),
    ...(row.finished_at ? { finishedAt: toIso(row.finished_at) } : {}),
    toolCalls: parseJsonColumn(row.tool_calls_json),
    decisions: parseJsonColumn(row.decisions_json),
    actionLog: parseJsonColumn(row.action_log_json),
    failures: parseJsonColumn(row.failures_json),
    ...(row.artifact_id ? { artifactId: row.artifact_id } : {}),
    ...(row.summary ? { summary: row.summary } : {}),
    ...(row.error_message ? { errorMessage: row.error_message } : {}),
  };
}

/**
 * MySQL-backed AgentRunReadModelStore — see packages/db's
 * observability-migration.ts for the `observability_agent_runs` schema.
 * `project()` still folds the event in application code (via the shared
 * `projectRuntimeEvent` reducer) then upserts the resulting snapshot —
 * MySQL only durably stores the result, it doesn't need its own
 * read-modify-write logic duplicated in SQL.
 */
export class MySqlAgentRunReadModelStore implements AgentRunReadModelStore {
  constructor(private readonly options: MySqlAgentRunReadModelStoreOptions) {}

  async upsert(snapshot: AgentRunSnapshot): Promise<void> {
    await this.options.db.execute(
      `INSERT INTO observability_agent_runs (
         work_package_id, run_id, exec_id, specialist_id, agent_id, task_ids_json,
         correlation_id, status, current_action, current_tool, current_tool_input_json,
         started_at, updated_at, finished_at, tool_calls_json, decisions_json,
         action_log_json, failures_json, artifact_id, summary, error_message
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         run_id=VALUES(run_id), exec_id=VALUES(exec_id), specialist_id=VALUES(specialist_id),
         agent_id=VALUES(agent_id), task_ids_json=VALUES(task_ids_json),
         correlation_id=VALUES(correlation_id), status=VALUES(status),
         current_action=VALUES(current_action), current_tool=VALUES(current_tool),
         current_tool_input_json=VALUES(current_tool_input_json), updated_at=VALUES(updated_at),
         finished_at=VALUES(finished_at), tool_calls_json=VALUES(tool_calls_json),
         decisions_json=VALUES(decisions_json), action_log_json=VALUES(action_log_json),
         failures_json=VALUES(failures_json), artifact_id=VALUES(artifact_id),
         summary=VALUES(summary), error_message=VALUES(error_message)`,
      [
        snapshot.workPackageId,
        snapshot.runId ?? null,
        snapshot.execId ?? null,
        snapshot.specialistId ?? null,
        snapshot.agentId ?? null,
        snapshot.taskIds ? JSON.stringify(snapshot.taskIds) : null,
        snapshot.correlationId,
        snapshot.status,
        snapshot.currentAction,
        snapshot.currentTool ?? null,
        snapshot.currentToolInput !== undefined ? JSON.stringify(snapshot.currentToolInput) : null,
        toMySqlDateTime(snapshot.startedAt),
        toMySqlDateTime(snapshot.updatedAt),
        toMySqlDateTimeOrNull(snapshot.finishedAt),
        JSON.stringify(snapshot.toolCalls),
        JSON.stringify(snapshot.decisions),
        JSON.stringify(snapshot.actionLog),
        JSON.stringify(snapshot.failures),
        snapshot.artifactId ?? null,
        snapshot.summary ?? null,
        snapshot.errorMessage ?? null,
      ],
    );
  }

  async get(workPackageId: string): Promise<AgentRunSnapshot | undefined> {
    const rows = await this.options.db.execute<AgentRunRow[]>(
      'SELECT * FROM observability_agent_runs WHERE work_package_id = ? LIMIT 1',
      [workPackageId],
    );
    return rows[0] ? rowToAgentRun(rows[0]) : undefined;
  }

  async list(filter?: { status?: AgentRunStatus }): Promise<AgentRunSnapshot[]> {
    const where = filter?.status ? ' WHERE status = ?' : '';
    const params = filter?.status ? [filter.status] : [];
    const rows = await this.options.db.execute<AgentRunRow[]>(
      `SELECT * FROM observability_agent_runs${where} ORDER BY updated_at DESC`,
      params,
    );
    return rows.map(rowToAgentRun);
  }

  async project(event: EventEnvelope): Promise<AgentRunSnapshot | undefined> {
    const workPackageId = typeof event.payload.workPackageId === 'string' ? event.payload.workPackageId : '';
    if (!workPackageId) return undefined;
    const existing = await this.get(workPackageId);
    const next = projectRuntimeEvent(existing, event);
    if (next) {
      await this.upsert(next);
    }
    return next;
  }
}

// --- Agent Registry ------------------------------------------------------

export type MySqlAgentRegistryStoreOptions = {
  db: MySqlExecutor;
};

type AgentRow = {
  agent_id: string;
  specialist_id: string;
  name: string | null;
  department: string | null;
  capability_ids_json: string | string[] | null;
  status: AgentSnapshotStatus;
  last_seen_at: string;
  current_work_package_id: string | null;
  current_task_ids_json: string | string[] | null;
  current_agent_run_id: string | null;
  correlation_id: string | null;
};

function rowToAgent(row: AgentRow): AgentSnapshot {
  return {
    agentId: row.agent_id,
    specialistId: row.specialist_id,
    ...(row.name ? { name: row.name } : {}),
    ...(row.department ? { department: row.department } : {}),
    ...(row.capability_ids_json ? { capabilityIds: parseJsonColumn(row.capability_ids_json) } : {}),
    status: row.status,
    lastSeenAt: toIso(row.last_seen_at),
    ...(row.current_work_package_id ? { currentWorkPackageId: row.current_work_package_id } : {}),
    ...(row.current_task_ids_json ? { currentTaskIds: parseJsonColumn(row.current_task_ids_json) } : {}),
    ...(row.current_agent_run_id ? { currentAgentRunId: row.current_agent_run_id } : {}),
    ...(row.correlation_id ? { correlationId: row.correlation_id } : {}),
  };
}

/**
 * MySQL-backed AgentRegistryStore — see packages/db's
 * observability-migration.ts for the `observability_agents` schema. Same
 * fold-then-upsert shape as MySqlAgentRunReadModelStore above.
 */
export class MySqlAgentRegistryStore implements AgentRegistryStore {
  constructor(private readonly options: MySqlAgentRegistryStoreOptions) {}

  async upsert(snapshot: AgentSnapshot): Promise<void> {
    await this.options.db.execute(
      `INSERT INTO observability_agents (
         agent_id, specialist_id, name, department, capability_ids_json, status,
         last_seen_at, current_work_package_id, current_task_ids_json,
         current_agent_run_id, correlation_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         specialist_id=VALUES(specialist_id), name=VALUES(name), department=VALUES(department),
         capability_ids_json=VALUES(capability_ids_json), status=VALUES(status),
         last_seen_at=VALUES(last_seen_at), current_work_package_id=VALUES(current_work_package_id),
         current_task_ids_json=VALUES(current_task_ids_json),
         current_agent_run_id=VALUES(current_agent_run_id), correlation_id=VALUES(correlation_id)`,
      [
        snapshot.agentId,
        snapshot.specialistId,
        snapshot.name ?? null,
        snapshot.department ?? null,
        snapshot.capabilityIds ? JSON.stringify(snapshot.capabilityIds) : null,
        snapshot.status,
        toMySqlDateTime(snapshot.lastSeenAt),
        snapshot.currentWorkPackageId ?? null,
        snapshot.currentTaskIds ? JSON.stringify(snapshot.currentTaskIds) : null,
        snapshot.currentAgentRunId ?? null,
        snapshot.correlationId ?? null,
      ],
    );
  }

  async get(agentId: string): Promise<AgentSnapshot | undefined> {
    const rows = await this.options.db.execute<AgentRow[]>(
      'SELECT * FROM observability_agents WHERE agent_id = ? LIMIT 1',
      [agentId],
    );
    return rows[0] ? rowToAgent(rows[0]) : undefined;
  }

  async list(filter?: {
    status?: AgentSnapshotStatus;
    department?: string;
    specialistId?: string;
  }): Promise<AgentSnapshot[]> {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (filter?.status) {
      clauses.push('status = ?');
      params.push(filter.status);
    }
    if (filter?.department) {
      clauses.push('department = ?');
      params.push(filter.department);
    }
    if (filter?.specialistId) {
      clauses.push('specialist_id = ?');
      params.push(filter.specialistId);
    }
    const where = clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '';
    const rows = await this.options.db.execute<AgentRow[]>(
      `SELECT * FROM observability_agents${where} ORDER BY last_seen_at DESC`,
      params,
    );
    return rows.map(rowToAgent);
  }

  async project(event: EventEnvelope): Promise<AgentSnapshot | undefined> {
    const payload = event.payload;
    const agentId = typeof payload.agentId === 'string' && payload.agentId.length > 0 ? payload.agentId : undefined;
    const existing = agentId ? await this.get(agentId) : undefined;
    const next = projectAgentEvent(existing, event);
    if (next) {
      await this.upsert(next);
    }
    return next;
  }
}
