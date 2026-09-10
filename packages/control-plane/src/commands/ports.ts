import type {
  Opportunity,
  ProjectContract,
  ProjectStatus,
  TaskContract,
  TaskStatus,
} from '@umer/contracts';

/**
 * Dependency ports the CEO Command Service is wired against. Deliberately
 * duck-typed against stores that already exist in apps/control-api
 * (ProjectStore, TaskStore) and @umer/opportunity-intelligence
 * (OpportunityPersistence) — this package never imports from an app, so these
 * are minimal structural shapes the real stores already satisfy, not new
 * store implementations.
 */

/** Matches @umer/opportunity-intelligence's `OpportunityPersistence` (subset used for writes). */
export type OpportunityWritePort = {
  getOpportunity(id: string): Promise<Opportunity | undefined>;
  saveOpportunity(opportunity: Opportunity): Promise<void>;
};

/** Matches apps/control-api's `ProjectStore`. */
export type ProjectWritePort = {
  get(projectId: string): Promise<ProjectContract | undefined>;
  create(
    input: {
      name: string;
      status?: ProjectStatus;
      owner?: string;
      sourceOpportunityId?: string;
      registryProjectId?: string;
    },
    correlationId: string,
  ): Promise<ProjectContract>;
  list(filter?: { status?: ProjectStatus; owner?: string }): Promise<ProjectContract[]>;
  updateStatus(
    projectId: string,
    status: ProjectStatus,
    correlationId: string,
  ): Promise<ProjectContract | undefined>;
};

/** Matches apps/control-api's `TaskStore` (plus `reassign`, added alongside this milestone). */
export type TaskWritePort = {
  get(taskId: string): Promise<TaskContract | undefined>;
  create(
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
  ): Promise<TaskContract>;
  assign(taskId: string, agentId: string, correlationId: string): Promise<TaskContract | undefined>;
  reassign(taskId: string, agentId: string, correlationId: string): Promise<TaskContract | undefined>;
  updateStatus(taskId: string, status: TaskStatus, correlationId: string): Promise<TaskContract | undefined>;
};

export type AgentControlState = 'active' | 'paused';

export type AgentControlRecord = {
  agentId: string;
  controlState: AgentControlState;
  reason?: string;
  updatedAt: string;
  lastCancelledWorkPackageId?: string;
  lastCancelledTaskId?: string;
};

/** Matches apps/control-api's (new) `AgentControlStore`. */
export type AgentControlPort = {
  get(agentId: string): Promise<AgentControlRecord | undefined>;
  pause(agentId: string, reason: string | undefined, correlationId: string): Promise<AgentControlRecord>;
  resume(agentId: string, correlationId: string): Promise<AgentControlRecord>;
  recordCancelWork(
    agentId: string,
    target: { workPackageId?: string; taskId?: string },
    reason: string | undefined,
    correlationId: string,
  ): Promise<AgentControlRecord>;
};

export type SpecialistControlState = 'active' | 'suspended';

export type SpecialistControlRecord = {
  specialistId: string;
  controlState: SpecialistControlState;
  reason?: string;
  updatedAt: string;
};

/**
 * Governs a specialist *type* (e.g. `eng.app-delivery`) company-wide — an
 * orthogonal axis to `AgentControlPort`, which governs one live agent
 * instance. Matches @umer/control-plane's `InMemorySpecialistControlStore` /
 * `MySqlSpecialistControlStore`.
 */
export type SpecialistControlPort = {
  get(specialistId: string): Promise<SpecialistControlRecord | undefined>;
  suspend(specialistId: string, reason: string | undefined, correlationId: string): Promise<SpecialistControlRecord>;
  activate(specialistId: string, correlationId: string): Promise<SpecialistControlRecord>;
  list(): Promise<SpecialistControlRecord[]>;
};
