import { randomUUID } from 'node:crypto';
import { SCHEMA_VERSION, TaskContractSchema, parseContract, type TaskContract, type TaskStatus } from '@umer/contracts';
import { createNoopAgentEventPublisher, type AgentEventPublisher } from '@umer/agent-runtime';
import type { TaskStore } from './task-store.js';

/**
 * MySQL adapter contract — intentionally injected (structural, not a driver
 * import), matching the MySqlExecutor shape used across this codebase.
 */
export type MySqlExecutor = {
  execute<T = unknown>(sql: string, params?: readonly unknown[]): Promise<T>;
};

export type MySqlTaskStoreOptions = {
  db: MySqlExecutor;
  events?: AgentEventPublisher;
};

type TaskRow = {
  task_id: string;
  header_id: string;
  epic_id: string;
  project_id: string;
  title: string;
  description: string;
  status: TaskStatus;
  work_class: string;
  acceptance_criteria_json: string | string[];
  capability_ids_json: string | string[];
  owner: string | null;
  assigned_agent_id: string | null;
  sprint_id: string | null;
  work_package_id: string | null;
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

function rowToTask(row: TaskRow): TaskContract {
  return parseContract(TaskContractSchema, {
    id: row.header_id,
    schemaVersion: SCHEMA_VERSION,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    metadata: parseJsonColumn(row.metadata_json),
    kind: 'task',
    taskId: row.task_id,
    epicId: row.epic_id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    status: row.status,
    workClass: row.work_class,
    acceptanceCriteria: parseJsonColumn(row.acceptance_criteria_json),
    capabilityIds: parseJsonColumn(row.capability_ids_json),
    ...(row.owner ? { owner: row.owner } : {}),
    ...(row.assigned_agent_id ? { assignedAgentId: row.assigned_agent_id } : {}),
    ...(row.sprint_id ? { sprintId: row.sprint_id } : {}),
    ...(row.work_package_id ? { workPackageId: row.work_package_id } : {}),
  });
}

/**
 * MySQL-backed TaskStore — see packages/db's work-management-migration.ts
 * for the `work_management_tasks` schema. Every write is an upsert keyed by
 * task_id.
 */
export class MySqlTaskStore implements TaskStore {
  private readonly db: MySqlExecutor;
  private readonly events: AgentEventPublisher;

  constructor(options: MySqlTaskStoreOptions) {
    this.db = options.db;
    this.events = options.events ?? createNoopAgentEventPublisher();
  }

  private async upsert(task: TaskContract): Promise<void> {
    await this.db.execute(
      `INSERT INTO work_management_tasks (
         task_id, header_id, epic_id, project_id, title, description, status,
         work_class, acceptance_criteria_json, capability_ids_json, owner,
         assigned_agent_id, sprint_id, work_package_id, metadata_json,
         created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         title=VALUES(title), description=VALUES(description), status=VALUES(status),
         work_class=VALUES(work_class), acceptance_criteria_json=VALUES(acceptance_criteria_json),
         capability_ids_json=VALUES(capability_ids_json), owner=VALUES(owner),
         assigned_agent_id=VALUES(assigned_agent_id), sprint_id=VALUES(sprint_id),
         work_package_id=VALUES(work_package_id), metadata_json=VALUES(metadata_json),
         updated_at=VALUES(updated_at)`,
      [
        task.taskId,
        task.id,
        task.epicId,
        task.projectId,
        task.title,
        task.description,
        task.status,
        task.workClass,
        JSON.stringify(task.acceptanceCriteria),
        JSON.stringify(task.capabilityIds),
        task.owner ?? null,
        task.assignedAgentId ?? null,
        task.sprintId ?? null,
        task.workPackageId ?? null,
        JSON.stringify(task.metadata),
        toMySqlDateTime(task.createdAt),
        toMySqlDateTime(task.updatedAt),
      ],
    );
  }

  async create(
    input: {
      epicId: string;
      projectId: string;
      title: string;
      description: string;
      acceptanceCriteria: string[];
      status?: TaskStatus;
      capabilityIds?: string[];
    },
    correlationId: string,
  ): Promise<TaskContract> {
    const taskId = `task-${randomUUID()}`;
    const now = new Date().toISOString();
    const task = parseContract(TaskContractSchema, {
      id: taskId,
      schemaVersion: SCHEMA_VERSION,
      createdAt: now,
      updatedAt: now,
      metadata: { labels: {}, annotations: {} },
      kind: 'task',
      taskId,
      epicId: input.epicId,
      projectId: input.projectId,
      title: input.title,
      description: input.description,
      status: input.status ?? 'Backlog',
      acceptanceCriteria: input.acceptanceCriteria,
      capabilityIds: input.capabilityIds ?? [],
    });
    await this.upsert(task);
    await this.events.publish('task.created', correlationId, {
      taskId,
      projectId: task.projectId,
      title: task.title,
      status: task.status,
    });
    return task;
  }

  async get(taskId: string): Promise<TaskContract | undefined> {
    const rows = await this.db.execute<TaskRow[]>(
      'SELECT * FROM work_management_tasks WHERE task_id = ? LIMIT 1',
      [taskId],
    );
    return rows[0] ? rowToTask(rows[0]) : undefined;
  }

  async list(filter?: {
    status?: TaskStatus;
    assignedAgentId?: string;
    projectId?: string;
  }): Promise<TaskContract[]> {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (filter?.status) {
      clauses.push('status = ?');
      params.push(filter.status);
    }
    if (filter?.assignedAgentId) {
      clauses.push('assigned_agent_id = ?');
      params.push(filter.assignedAgentId);
    }
    if (filter?.projectId) {
      clauses.push('project_id = ?');
      params.push(filter.projectId);
    }
    const where = clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '';
    const rows = await this.db.execute<TaskRow[]>(
      `SELECT * FROM work_management_tasks${where} ORDER BY created_at DESC`,
      params,
    );
    return rows.map(rowToTask);
  }

  async assign(taskId: string, agentId: string, correlationId: string): Promise<TaskContract | undefined> {
    const existing = await this.get(taskId);
    if (!existing) {
      return undefined;
    }
    const updated: TaskContract = {
      ...existing,
      assignedAgentId: agentId as TaskContract['assignedAgentId'],
      status: existing.status === 'Backlog' || existing.status === 'Ready' ? 'Assigned' : existing.status,
      updatedAt: new Date().toISOString(),
    };
    await this.upsert(updated);
    await this.events.publish('task.assigned', correlationId, {
      taskId,
      agentId,
      projectId: updated.projectId,
    });
    return updated;
  }

  async reassign(taskId: string, agentId: string, correlationId: string): Promise<TaskContract | undefined> {
    const existing = await this.get(taskId);
    if (!existing) {
      return undefined;
    }
    const previousAgentId = existing.assignedAgentId;
    const updated: TaskContract = {
      ...existing,
      assignedAgentId: agentId as TaskContract['assignedAgentId'],
      updatedAt: new Date().toISOString(),
    };
    await this.upsert(updated);
    await this.events.publish('task.assigned', correlationId, {
      taskId,
      agentId,
      previousAgentId,
      projectId: updated.projectId,
    });
    return updated;
  }

  async updateStatus(taskId: string, status: TaskStatus, correlationId: string): Promise<TaskContract | undefined> {
    const existing = await this.get(taskId);
    if (!existing) {
      return undefined;
    }
    const updated: TaskContract = { ...existing, status, updatedAt: new Date().toISOString() };
    await this.upsert(updated);
    await this.events.publish('task.status.changed', correlationId, {
      taskId,
      status,
      previousStatus: existing.status,
      projectId: updated.projectId,
    });
    return updated;
  }

  async linkWorkPackage(taskId: string, workPackageId: string): Promise<TaskContract | undefined> {
    const existing = await this.get(taskId);
    if (!existing) {
      return undefined;
    }
    const updated: TaskContract = { ...existing, workPackageId, updatedAt: new Date().toISOString() };
    await this.upsert(updated);
    return updated;
  }
}
