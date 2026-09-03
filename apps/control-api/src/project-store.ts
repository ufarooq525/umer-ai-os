import { randomUUID } from 'node:crypto';
import { ProjectContractSchema, SCHEMA_VERSION, parseContract, type ProjectContract, type ProjectStatus } from '@umer/contracts';
import { createNoopAgentEventPublisher, type AgentEventPublisher } from '@umer/agent-runtime';

/**
 * Work Management Project store — control-api owns Work Management read
 * models per MONOREPO_BLUEPRINT.md §2. In-memory only in this milestone (see
 * implementation/COMPANY_OPERATING_MODEL.md §Persistence): no domain in this
 * codebase persists to Postgres yet, so this follows the same
 * interface-plus-InMemory-default shape as every other store here
 * (GrantStore, ArtifactStore, AuditStore, AgentRunReadModelStore, ...).
 */
export type ProjectStore = {
  create(input: {
    name: string;
    status?: ProjectStatus;
    owner?: string;
    sourceOpportunityId?: string;
    registryProjectId?: string;
  }, correlationId: string): Promise<ProjectContract>;
  get(projectId: string): Promise<ProjectContract | undefined>;
  list(filter?: { status?: ProjectStatus; owner?: string }): Promise<ProjectContract[]>;
  updateStatus(projectId: string, status: ProjectStatus, correlationId: string): Promise<ProjectContract | undefined>;
};

export class InMemoryProjectStore implements ProjectStore {
  private readonly byProjectId = new Map<string, ProjectContract>();
  private readonly events: AgentEventPublisher;

  constructor(options: { events?: AgentEventPublisher } = {}) {
    this.events = options.events ?? createNoopAgentEventPublisher();
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
    this.byProjectId.set(projectId, project);
    await this.events.publish('project.created', correlationId, {
      projectId,
      name: project.name,
      status: project.status,
      sourceOpportunityId: project.sourceOpportunityId,
    });
    return project;
  }

  async get(projectId: string): Promise<ProjectContract | undefined> {
    return this.byProjectId.get(projectId);
  }

  async list(filter?: { status?: ProjectStatus; owner?: string }): Promise<ProjectContract[]> {
    const all = [...this.byProjectId.values()];
    return all.filter((project) => {
      if (filter?.status && project.status !== filter.status) return false;
      if (filter?.owner && project.owner !== filter.owner) return false;
      return true;
    });
  }

  async updateStatus(
    projectId: string,
    status: ProjectStatus,
    correlationId: string,
  ): Promise<ProjectContract | undefined> {
    const existing = this.byProjectId.get(projectId);
    if (!existing) {
      return undefined;
    }
    const updated: ProjectContract = { ...existing, status, updatedAt: new Date().toISOString() };
    this.byProjectId.set(projectId, updated);
    await this.events.publish('project.status.changed', correlationId, {
      projectId,
      status,
      previousStatus: existing.status,
    });
    return updated;
  }
}
