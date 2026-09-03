import { randomUUID } from 'node:crypto';
import { SCHEMA_VERSION, TaskContractSchema, parseContract, type TaskContract, type TaskStatus } from '@umer/contracts';
import { createNoopAgentEventPublisher, type AgentEventPublisher } from '@umer/agent-runtime';

/**
 * Task store — Work Management read model owned by control-api (same
 * ownership/persistence reasoning as project-store.ts). A Task here is the
 * existing @umer/contracts TaskContract, extended last with `assignedAgentId`
 * — not a new "AgentTask" noun.
 */
export type TaskStore = {
  create(input: {
    epicId: string;
    projectId: string;
    title: string;
    description: string;
    acceptanceCriteria: string[];
    status?: TaskStatus;
    capabilityIds?: string[];
  }, correlationId: string): Promise<TaskContract>;
  get(taskId: string): Promise<TaskContract | undefined>;
  list(filter?: { status?: TaskStatus; assignedAgentId?: string; projectId?: string }): Promise<TaskContract[]>;
  assign(taskId: string, agentId: string, correlationId: string): Promise<TaskContract | undefined>;
  /** Reassign an already-assigned task to a different agent — see CommandError's INVALID_TRANSITION guard in the ReassignTask command handler for the "must already be assigned" rule. */
  reassign(taskId: string, agentId: string, correlationId: string): Promise<TaskContract | undefined>;
  updateStatus(taskId: string, status: TaskStatus, correlationId: string): Promise<TaskContract | undefined>;
  linkWorkPackage(taskId: string, workPackageId: string): Promise<TaskContract | undefined>;
};

export class InMemoryTaskStore implements TaskStore {
  private readonly byTaskId = new Map<string, TaskContract>();
  private readonly events: AgentEventPublisher;

  constructor(options: { events?: AgentEventPublisher } = {}) {
    this.events = options.events ?? createNoopAgentEventPublisher();
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
    this.byTaskId.set(taskId, task);
    await this.events.publish('task.created', correlationId, {
      taskId,
      projectId: task.projectId,
      title: task.title,
      status: task.status,
    });
    return task;
  }

  async get(taskId: string): Promise<TaskContract | undefined> {
    return this.byTaskId.get(taskId);
  }

  async list(filter?: {
    status?: TaskStatus;
    assignedAgentId?: string;
    projectId?: string;
  }): Promise<TaskContract[]> {
    const all = [...this.byTaskId.values()];
    return all.filter((task) => {
      if (filter?.status && task.status !== filter.status) return false;
      if (filter?.assignedAgentId && task.assignedAgentId !== filter.assignedAgentId) return false;
      if (filter?.projectId && task.projectId !== filter.projectId) return false;
      return true;
    });
  }

  async assign(taskId: string, agentId: string, correlationId: string): Promise<TaskContract | undefined> {
    const existing = this.byTaskId.get(taskId);
    if (!existing) {
      return undefined;
    }
    const updated: TaskContract = {
      ...existing,
      assignedAgentId: agentId as TaskContract['assignedAgentId'],
      status: existing.status === 'Backlog' || existing.status === 'Ready' ? 'Assigned' : existing.status,
      updatedAt: new Date().toISOString(),
    };
    this.byTaskId.set(taskId, updated);
    await this.events.publish('task.assigned', correlationId, {
      taskId,
      agentId,
      projectId: updated.projectId,
    });
    return updated;
  }

  async reassign(taskId: string, agentId: string, correlationId: string): Promise<TaskContract | undefined> {
    const existing = this.byTaskId.get(taskId);
    if (!existing) {
      return undefined;
    }
    const previousAgentId = existing.assignedAgentId;
    const updated: TaskContract = {
      ...existing,
      assignedAgentId: agentId as TaskContract['assignedAgentId'],
      updatedAt: new Date().toISOString(),
    };
    this.byTaskId.set(taskId, updated);
    await this.events.publish('task.assigned', correlationId, {
      taskId,
      agentId,
      previousAgentId,
      projectId: updated.projectId,
    });
    return updated;
  }

  async updateStatus(taskId: string, status: TaskStatus, correlationId: string): Promise<TaskContract | undefined> {
    const existing = this.byTaskId.get(taskId);
    if (!existing) {
      return undefined;
    }
    const updated: TaskContract = { ...existing, status, updatedAt: new Date().toISOString() };
    this.byTaskId.set(taskId, updated);
    await this.events.publish('task.status.changed', correlationId, {
      taskId,
      status,
      previousStatus: existing.status,
      projectId: updated.projectId,
    });
    return updated;
  }

  async linkWorkPackage(taskId: string, workPackageId: string): Promise<TaskContract | undefined> {
    const existing = this.byTaskId.get(taskId);
    if (!existing) {
      return undefined;
    }
    const updated: TaskContract = { ...existing, workPackageId, updatedAt: new Date().toISOString() };
    this.byTaskId.set(taskId, updated);
    return updated;
  }
}
