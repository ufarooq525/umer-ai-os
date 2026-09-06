import { randomUUID } from 'node:crypto';
import { ProjectContractSchema, SCHEMA_VERSION, parseContract, type ProjectContract, type ProjectStatus } from '@umer/contracts';
import { createNoopAgentEventPublisher, type AgentEventPublisher } from '@umer/agent-runtime';
import type { ProjectStore } from './project-store.js';

/**
 * MySQL adapter contract — intentionally injected (structural, not a driver
 * import), matching the MySqlExecutor shape used across this codebase.
 */
export type MySqlExecutor = {
  execute<T = unknown>(sql: string, params?: readonly unknown[]): Promise<T>;
};

export type MySqlProjectStoreOptions = {
  db: MySqlExecutor;
  events?: AgentEventPublisher;
};

type ProjectRow = {
  project_id: string;
  header_id: string;
  name: string;
  status: ProjectStatus;
  owner: string | null;
  source_opportunity_id: string | null;
  registry_project_id: string | null;
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

function rowToProject(row: ProjectRow): ProjectContract {
  return parseContract(ProjectContractSchema, {
    id: row.header_id,
    schemaVersion: SCHEMA_VERSION,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    metadata: parseJsonColumn(row.metadata_json),
    kind: 'project',
    projectId: row.project_id,
    name: row.name,
    status: row.status,
    ...(row.owner ? { owner: row.owner } : {}),
    ...(row.source_opportunity_id ? { sourceOpportunityId: row.source_opportunity_id } : {}),
    ...(row.registry_project_id ? { registryProjectId: row.registry_project_id } : {}),
  });
}

/**
 * MySQL-backed ProjectStore — see packages/db's work-management-migration.ts
 * for the `work_management_projects` schema. Every write is an upsert keyed
 * by project_id.
 */
export class MySqlProjectStore implements ProjectStore {
  private readonly db: MySqlExecutor;
  private readonly events: AgentEventPublisher;

  constructor(options: MySqlProjectStoreOptions) {
    this.db = options.db;
    this.events = options.events ?? createNoopAgentEventPublisher();
  }

  private async upsert(project: ProjectContract): Promise<void> {
    await this.db.execute(
      `INSERT INTO work_management_projects (
         project_id, header_id, name, status, owner, source_opportunity_id,
         registry_project_id, metadata_json, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name=VALUES(name), status=VALUES(status), owner=VALUES(owner),
         source_opportunity_id=VALUES(source_opportunity_id),
         registry_project_id=VALUES(registry_project_id),
         metadata_json=VALUES(metadata_json), updated_at=VALUES(updated_at)`,
      [
        project.projectId,
        project.id,
        project.name,
        project.status,
        project.owner ?? null,
        project.sourceOpportunityId ?? null,
        project.registryProjectId ?? null,
        JSON.stringify(project.metadata),
        toMySqlDateTime(project.createdAt),
        toMySqlDateTime(project.updatedAt),
      ],
    );
  }

  async create(
    input: {
      name: string;
      status?: ProjectStatus;
      owner?: string;
      sourceOpportunityId?: string;
      registryProjectId?: string;
    },
    correlationId: string,
  ): Promise<ProjectContract> {
    const projectId = `proj-${randomUUID()}`;
    const now = new Date().toISOString();
    const project = parseContract(ProjectContractSchema, {
      id: projectId,
      schemaVersion: SCHEMA_VERSION,
      createdAt: now,
      updatedAt: now,
      metadata: { labels: {}, annotations: {} },
      kind: 'project',
      projectId,
      name: input.name,
      status: input.status ?? 'Forming',
      owner: input.owner,
      sourceOpportunityId: input.sourceOpportunityId,
      registryProjectId: input.registryProjectId,
    });
    await this.upsert(project);
    await this.events.publish('project.created', correlationId, {
      projectId,
      name: project.name,
      status: project.status,
      sourceOpportunityId: project.sourceOpportunityId,
    });
    return project;
  }

  async get(projectId: string): Promise<ProjectContract | undefined> {
    const rows = await this.db.execute<ProjectRow[]>(
      'SELECT * FROM work_management_projects WHERE project_id = ? LIMIT 1',
      [projectId],
    );
    return rows[0] ? rowToProject(rows[0]) : undefined;
  }

  async list(filter?: { status?: ProjectStatus; owner?: string }): Promise<ProjectContract[]> {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (filter?.status) {
      clauses.push('status = ?');
      params.push(filter.status);
    }
    if (filter?.owner) {
      clauses.push('owner = ?');
      params.push(filter.owner);
    }
    const where = clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '';
    const rows = await this.db.execute<ProjectRow[]>(
      `SELECT * FROM work_management_projects${where} ORDER BY created_at DESC`,
      params,
    );
    return rows.map(rowToProject);
  }

  async updateStatus(
    projectId: string,
    status: ProjectStatus,
    correlationId: string,
  ): Promise<ProjectContract | undefined> {
    const existing = await this.get(projectId);
    if (!existing) {
      return undefined;
    }
    const updated: ProjectContract = { ...existing, status, updatedAt: new Date().toISOString() };
    await this.upsert(updated);
    await this.events.publish('project.status.changed', correlationId, {
      projectId,
      status,
      previousStatus: existing.status,
    });
    return updated;
  }
}
