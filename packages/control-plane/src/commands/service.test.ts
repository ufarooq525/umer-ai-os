import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SCHEMA_VERSION, type CeoCommandEnvelope, type Opportunity, type ProjectContract, type ProjectStatus, type TaskContract, type TaskStatus } from '@umer/contracts';
import { createAuditService, type AuditService } from '@umer/audit';
import { createTrustRuntime, type TrustRuntime } from '@umer/trust';
import { CommandError } from './errors.js';
import { createCeoCommandService } from './factory.js';
import type { CeoCommandService } from './service.js';
import type { AgentControlPort, AgentControlRecord, OpportunityWritePort, ProjectWritePort, TaskWritePort } from './ports.js';

// --- Fake ports (duck-typed the same way apps/control-api's real stores are) ---

function makeOpportunity(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: 'opp-1',
    type: 'product',
    title: 'Telehealth billing automation',
    geography: 'US',
    market: 'Healthcare SaaS',
    problemIds: ['prob-1'],
    score: {
      problemSeverity: 80,
      demandEvidence: 70,
      abilityToPay: 60,
      reachability: 50,
      solutionFit: 75,
      competitiveGap: 40,
      deliveryFeasibility: 65,
      evidenceConfidence: 70,
      overall: 65,
      recommendation: 'outreach_ready',
    },
    evidenceRefs: ['ev-1'],
    status: 'discovered',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

class FakeOpportunityPort implements OpportunityWritePort {
  readonly byId = new Map<string, Opportunity>();
  seed(opportunity: Opportunity): void {
    this.byId.set(opportunity.id, opportunity);
  }
  async getOpportunity(id: string): Promise<Opportunity | undefined> {
    return this.byId.get(id);
  }
  async saveOpportunity(opportunity: Opportunity): Promise<void> {
    this.byId.set(opportunity.id, opportunity);
  }
}

class FakeProjectPort implements ProjectWritePort {
  readonly byId = new Map<string, ProjectContract>();
  private seq = 0;
  async get(projectId: string): Promise<ProjectContract | undefined> {
    return this.byId.get(projectId);
  }
  async create(
    input: { name: string; status?: ProjectStatus; owner?: string; sourceOpportunityId?: string; registryProjectId?: string },
  ): Promise<ProjectContract> {
    const projectId = `proj-${++this.seq}`;
    const now = new Date().toISOString();
    const project: ProjectContract = {
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
    };
    this.byId.set(projectId, project);
    return project;
  }
  async list(filter?: { status?: ProjectStatus; owner?: string }): Promise<ProjectContract[]> {
    return [...this.byId.values()].filter(
      (p) => (!filter?.status || p.status === filter.status) && (!filter?.owner || p.owner === filter.owner),
    );
  }
  async updateStatus(projectId: string, status: ProjectStatus): Promise<ProjectContract | undefined> {
    const existing = this.byId.get(projectId);
    if (!existing) return undefined;
    const updated = { ...existing, status, updatedAt: new Date().toISOString() };
    this.byId.set(projectId, updated);
    return updated;
  }
}

class FakeTaskPort implements TaskWritePort {
  readonly byId = new Map<string, TaskContract>();
  private seq = 0;
  async get(taskId: string): Promise<TaskContract | undefined> {
    return this.byId.get(taskId);
  }
  async create(input: {
    epicId: string;
    projectId: string;
    title: string;
    description: string;
    acceptanceCriteria: string[];
    status?: TaskStatus;
    capabilityIds?: string[];
  }): Promise<TaskContract> {
    const taskId = `task-${++this.seq}`;
    const now = new Date().toISOString();
    const task: TaskContract = {
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
      workClass: 'Standard',
      acceptanceCriteria: input.acceptanceCriteria,
      capabilityIds: input.capabilityIds ?? [],
    };
    this.byId.set(taskId, task);
    return task;
  }
  async assign(taskId: string, agentId: string): Promise<TaskContract | undefined> {
    const existing = this.byId.get(taskId);
    if (!existing) return undefined;
    const updated: TaskContract = { ...existing, assignedAgentId: agentId as TaskContract['assignedAgentId'], status: 'Assigned' };
    this.byId.set(taskId, updated);
    return updated;
  }
  async reassign(taskId: string, agentId: string): Promise<TaskContract | undefined> {
    const existing = this.byId.get(taskId);
    if (!existing) return undefined;
    const updated: TaskContract = { ...existing, assignedAgentId: agentId as TaskContract['assignedAgentId'] };
    this.byId.set(taskId, updated);
    return updated;
  }
  async updateStatus(taskId: string, status: TaskStatus): Promise<TaskContract | undefined> {
    const existing = this.byId.get(taskId);
    if (!existing) return undefined;
    const updated = { ...existing, status };
    this.byId.set(taskId, updated);
    return updated;
  }
}

class FakeAgentControlPort implements AgentControlPort {
  readonly byId = new Map<string, AgentControlRecord>();
  async get(agentId: string): Promise<AgentControlRecord | undefined> {
    return this.byId.get(agentId);
  }
  async pause(agentId: string, reason: string | undefined): Promise<AgentControlRecord> {
    const record: AgentControlRecord = { agentId, controlState: 'paused', reason, updatedAt: new Date().toISOString() };
    this.byId.set(agentId, record);
    return record;
  }
  async resume(agentId: string): Promise<AgentControlRecord> {
    const record: AgentControlRecord = { agentId, controlState: 'active', updatedAt: new Date().toISOString() };
    this.byId.set(agentId, record);
    return record;
  }
  async recordCancelWork(agentId: string, target: { workPackageId?: string; taskId?: string }): Promise<AgentControlRecord> {
    const existing = this.byId.get(agentId);
    const record: AgentControlRecord = {
      agentId,
      controlState: existing?.controlState ?? 'active',
      updatedAt: new Date().toISOString(),
      lastCancelledWorkPackageId: target.workPackageId,
      lastCancelledTaskId: target.taskId,
    };
    this.byId.set(agentId, record);
    return record;
  }
}

const ceoActor = { principalId: 'human.ceo', kind: 'human' as const };
const agentActor = { principalId: 'agent-1', kind: 'specialist_run' as const };

function buildCommand(overrides: Partial<CeoCommandEnvelope> & { name: string; payload?: Record<string, unknown> }): CeoCommandEnvelope {
  return {
    commandId: `cmd-${randomUUID()}`,
    schemaVersion: SCHEMA_VERSION,
    issuedAt: new Date().toISOString(),
    correlationId: `corr-${randomUUID()}`,
    producer: 'test',
    payload: {},
    actor: ceoActor,
    ...overrides,
  } as unknown as CeoCommandEnvelope;
}

describe('CeoCommandService', () => {
  let opportunities: FakeOpportunityPort;
  let projects: FakeProjectPort;
  let tasks: FakeTaskPort;
  let agentControl: FakeAgentControlPort;
  let trust: TrustRuntime;
  let auditService: AuditService;
  let service: CeoCommandService;

  beforeEach(async () => {
    opportunities = new FakeOpportunityPort();
    projects = new FakeProjectPort();
    tasks = new FakeTaskPort();
    agentControl = new FakeAgentControlPort();
    trust = createTrustRuntime();
    auditService = createAuditService();
    await trust.registerGrant({
      grantId: 'grant-ceo',
      principalId: ceoActor.principalId,
      action: '*',
      resourceType: 'command',
      effect: 'allow',
    });
    service = createCeoCommandService(
      { opportunities, projects, tasks, agentControl },
      { trust, auditService },
    );
  });

  describe('authorization', () => {
    it('rejects an actor with no grant', async () => {
      opportunities.seed(makeOpportunity());
      const command = buildCommand({
        name: 'SelectOpportunity',
        actor: agentActor,
        payload: { opportunityId: 'opp-1' },
      });
      await expect(service.execute(command)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    });

    it('audits a denied command', async () => {
      opportunities.seed(makeOpportunity());
      const command = buildCommand({ name: 'SelectOpportunity', actor: agentActor, payload: { opportunityId: 'opp-1' } });
      await expect(service.execute(command)).rejects.toThrow(CommandError);
      const audit = await auditService.query({ action: 'SelectOpportunity' });
      expect(audit).toHaveLength(1);
      expect(audit[0]?.outcome).toBe('denied');
    });

    it('TrustRuntime remains default-deny for an arbitrary agent principal with no grant, across every command type', async () => {
      opportunities.seed(makeOpportunity());
      const project = await projects.create({ name: 'X' }, 'corr-seed');
      const arbitraryAgent = { principalId: `agent-${randomUUID()}`, kind: 'specialist_run' as const };

      const attempts = [
        buildCommand({ name: 'SelectOpportunity', actor: arbitraryAgent, payload: { opportunityId: 'opp-1' } }),
        buildCommand({ name: 'CreateProject', actor: arbitraryAgent, payload: { name: 'Y' } }),
        buildCommand({ name: 'PauseProject', actor: arbitraryAgent, payload: { projectId: project.projectId } }),
        buildCommand({ name: 'PauseAgent', actor: arbitraryAgent, payload: { agentId: 'agent-1' } }),
      ];
      for (const command of attempts) {
        await expect(service.execute(command)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
      }
      // Nothing was authorized, so nothing should have mutated.
      expect(await projects.list()).toHaveLength(1);
      expect((await opportunities.getOpportunity('opp-1'))?.status).toBe('discovered');
    });
  });

  describe('SelectOpportunity / RejectOpportunity', () => {
    it('selects an opportunity, emits opportunity.selected, and is auditable', async () => {
      opportunities.seed(makeOpportunity());
      const command = buildCommand({ name: 'SelectOpportunity', payload: { opportunityId: 'opp-1' } });
      const result = await service.execute(command);

      expect(result.status).toBe('applied');
      expect((result.data as Opportunity).status).toBe('selected_for_execution');
      expect(result.events).toHaveLength(1);
      expect(result.events[0]?.name).toBe('opportunity.selected');
      expect((await opportunities.getOpportunity('opp-1'))?.status).toBe('selected_for_execution');

      const audit = await auditService.query({ correlationId: command.correlationId });
      expect(audit).toHaveLength(1);
      expect(audit[0]?.outcome).toBe('success');
    });

    it('rejects selecting an unknown opportunity', async () => {
      const command = buildCommand({ name: 'SelectOpportunity', payload: { opportunityId: 'does-not-exist' } });
      await expect(service.execute(command)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('rejects selecting an already-selected opportunity', async () => {
      opportunities.seed(makeOpportunity({ status: 'selected_for_execution' }));
      const command = buildCommand({ name: 'SelectOpportunity', payload: { opportunityId: 'opp-1' } });
      await expect(service.execute(command)).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
    });

    it('rejects an opportunity and emits opportunity.status.changed', async () => {
      opportunities.seed(makeOpportunity());
      const command = buildCommand({ name: 'RejectOpportunity', payload: { opportunityId: 'opp-1', reason: 'low value' } });
      const result = await service.execute(command);

      expect((result.data as Opportunity).status).toBe('rejected');
      expect(result.events[0]?.name).toBe('opportunity.status.changed');
      expect((await opportunities.getOpportunity('opp-1'))?.status).toBe('rejected');
    });

    it('rejects RejectOpportunity on an already-rejected opportunity', async () => {
      opportunities.seed(makeOpportunity({ status: 'rejected' }));
      const command = buildCommand({ name: 'RejectOpportunity', payload: { opportunityId: 'opp-1' } });
      await expect(service.execute(command)).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
    });
  });

  describe('CreateProjectFromOpportunity', () => {
    it('creates a Project from a selected Opportunity and marks it project_created', async () => {
      opportunities.seed(makeOpportunity({ status: 'selected_for_execution' }));
      const command = buildCommand({
        name: 'CreateProjectFromOpportunity',
        payload: { opportunityId: 'opp-1', owner: 'Growth Lead' },
      });
      const result = await service.execute(command);

      const data = result.data as { project: ProjectContract; opportunity: Opportunity };
      expect(data.project.sourceOpportunityId).toBe('opp-1');
      expect(data.project.name).toBe('Telehealth billing automation');
      expect(data.opportunity.status).toBe('project_created');
      expect(result.events.map((e) => e.name)).toEqual(
        expect.arrayContaining(['project.created', 'opportunity.project.created']),
      );
      expect((await opportunities.getOpportunity('opp-1'))?.status).toBe('project_created');
    });

    it('rejects creating a project from a non-selected opportunity', async () => {
      opportunities.seed(makeOpportunity({ status: 'discovered' }));
      const command = buildCommand({ name: 'CreateProjectFromOpportunity', payload: { opportunityId: 'opp-1' } });
      await expect(service.execute(command)).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
    });

    it('rejects creating a second project from the same opportunity', async () => {
      opportunities.seed(makeOpportunity({ status: 'selected_for_execution' }));
      const first = buildCommand({ name: 'CreateProjectFromOpportunity', payload: { opportunityId: 'opp-1' } });
      await service.execute(first);

      // The opportunity is now project_created — force it back to
      // selected_for_execution to isolate the "already has a project" guard
      // from the status guard above.
      const opp = await opportunities.getOpportunity('opp-1');
      await opportunities.saveOpportunity({ ...opp!, status: 'selected_for_execution' });

      const second = buildCommand({ name: 'CreateProjectFromOpportunity', payload: { opportunityId: 'opp-1' } });
      await expect(service.execute(second)).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
    });
  });

  describe('Project commands', () => {
    it('CreateProject creates a Forming project', async () => {
      const command = buildCommand({ name: 'CreateProject', payload: { name: 'X' } });
      const result = await service.execute(command);
      expect((result.data as ProjectContract).status).toBe('Forming');
    });

    it('CreateProject threads registryProjectId through to the created project', async () => {
      const command = buildCommand({
        name: 'CreateProject',
        payload: { name: 'Linked Project', registryProjectId: 'erp_web_dashboard' },
      });
      const result = await service.execute(command);
      expect((result.data as ProjectContract).registryProjectId).toBe('erp_web_dashboard');
    });

    it('PauseProject / ResumeProject round-trip', async () => {
      const project = await projects.create({ name: 'X' }, 'corr-seed');
      await service.execute(buildCommand({ name: 'PauseProject', payload: { projectId: project.projectId } }));
      expect((await projects.get(project.projectId))?.status).toBe('Paused');

      const resumed = await service.execute(buildCommand({ name: 'ResumeProject', payload: { projectId: project.projectId } }));
      expect((resumed.data as ProjectContract).status).toBe('Active');
    });

    it('PauseProject rejects an unknown project', async () => {
      const command = buildCommand({ name: 'PauseProject', payload: { projectId: 'does-not-exist' } });
      await expect(service.execute(command)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('ResumeProject rejects a project that is not Paused', async () => {
      const project = await projects.create({ name: 'X' }, 'corr-seed');
      const command = buildCommand({ name: 'ResumeProject', payload: { projectId: project.projectId } });
      await expect(service.execute(command)).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
    });

    it('CancelProject moves a project to Abandoned and rejects a repeat cancel', async () => {
      const project = await projects.create({ name: 'X' }, 'corr-seed');
      const result = await service.execute(buildCommand({ name: 'CancelProject', payload: { projectId: project.projectId } }));
      expect((result.data as ProjectContract).status).toBe('Abandoned');

      const again = buildCommand({ name: 'CancelProject', payload: { projectId: project.projectId } });
      await expect(service.execute(again)).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
    });
  });

  describe('Task commands', () => {
    it('CreateTask then AssignTask, and rejects a double-assign', async () => {
      const created = await service.execute(
        buildCommand({
          name: 'CreateTask',
          payload: {
            epicId: 'epic-1',
            projectId: 'proj-1',
            title: 'Do the thing',
            description: 'Details',
            acceptanceCriteria: ['done'],
          },
        }),
      );
      const task = created.data as TaskContract;

      const assigned = await service.execute(
        buildCommand({ name: 'AssignTask', payload: { taskId: task.taskId, agentId: 'agent-A' } }),
      );
      expect((assigned.data as TaskContract).assignedAgentId).toBe('agent-A');

      const again = buildCommand({ name: 'AssignTask', payload: { taskId: task.taskId, agentId: 'agent-B' } });
      await expect(service.execute(again)).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
    });

    it('ReassignTask changes the assignee, and rejects reassigning an unassigned task', async () => {
      const task = await tasks.create(
        { epicId: 'epic-1', projectId: 'proj-1', title: 'T', description: 'D', acceptanceCriteria: ['c'] },
        'corr-seed',
      );

      const unassigned = buildCommand({ name: 'ReassignTask', payload: { taskId: task.taskId, agentId: 'agent-A' } });
      await expect(service.execute(unassigned)).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });

      await tasks.assign(task.taskId, 'agent-A', 'corr-seed');
      const reassigned = await service.execute(
        buildCommand({ name: 'ReassignTask', payload: { taskId: task.taskId, agentId: 'agent-B' } }),
      );
      expect((reassigned.data as TaskContract).assignedAgentId).toBe('agent-B');
    });
  });

  describe('Agent control commands', () => {
    it('PauseAgent / ResumeAgent round-trip and reject double-pause', async () => {
      await service.execute(buildCommand({ name: 'PauseAgent', payload: { agentId: 'agent-1', reason: 'incident' } }));
      expect((await agentControl.get('agent-1'))?.controlState).toBe('paused');

      const again = buildCommand({ name: 'PauseAgent', payload: { agentId: 'agent-1' } });
      await expect(service.execute(again)).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });

      await service.execute(buildCommand({ name: 'ResumeAgent', payload: { agentId: 'agent-1' } }));
      expect((await agentControl.get('agent-1'))?.controlState).toBe('active');
    });

    it('ResumeAgent rejects an agent that is not paused', async () => {
      const command = buildCommand({ name: 'ResumeAgent', payload: { agentId: 'agent-1' } });
      await expect(service.execute(command)).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
    });

    it('CancelWork with a taskId cancels the Task and records the control intent', async () => {
      const task = await tasks.create(
        { epicId: 'epic-1', projectId: 'proj-1', title: 'T', description: 'D', acceptanceCriteria: ['c'] },
        'corr-seed',
      );
      await tasks.assign(task.taskId, 'agent-1', 'corr-seed');

      const result = await service.execute(
        buildCommand({ name: 'CancelWork', payload: { agentId: 'agent-1', taskId: task.taskId, reason: 'stale' } }),
      );

      const data = result.data as { task?: TaskContract };
      expect(data.task?.status).toBe('Cancelled');
      expect((await agentControl.get('agent-1'))?.lastCancelledTaskId).toBe(task.taskId);
      expect(result.events.map((e) => e.name)).toEqual(
        expect.arrayContaining(['agent.control.changed', 'task.status.changed']),
      );
    });

    it('CancelWork rejects an already-Done task without mutating agent control state', async () => {
      const task = await tasks.create(
        { epicId: 'epic-1', projectId: 'proj-1', title: 'T', description: 'D', acceptanceCriteria: ['c'] },
        'corr-seed',
      );
      await tasks.updateStatus(task.taskId, 'Done', 'corr-seed');

      const command = buildCommand({ name: 'CancelWork', payload: { agentId: 'agent-1', taskId: task.taskId } });
      await expect(service.execute(command)).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
      expect(await agentControl.get('agent-1')).toBeUndefined();
    });
  });

  describe('idempotency', () => {
    it('a duplicate commandId does not re-mutate state or re-publish events', async () => {
      const command = buildCommand({ name: 'CreateProject', payload: { name: 'X' } });

      const first = await service.execute(command);
      const second = await service.execute(command);

      expect(first.status).toBe('applied');
      expect(second.status).toBe('duplicate');
      expect(second.data).toEqual(first.data);
      expect(second.events).toEqual(first.events);
      expect(await projects.list()).toHaveLength(1);
    });

    it('honours an explicit idempotencyKey distinct from commandId', async () => {
      const idempotencyKey = `idem-${randomUUID()}`;
      const first = buildCommand({ name: 'CreateProject', payload: { name: 'X' }, idempotencyKey });
      const second = buildCommand({ name: 'CreateProject', payload: { name: 'X' }, idempotencyKey });

      const firstResult = await service.execute(first);
      const secondResult = await service.execute(second);

      expect(firstResult.status).toBe('applied');
      expect(secondResult.status).toBe('duplicate');
      expect(await projects.list()).toHaveLength(1);
    });
  });

  describe('duplicate-command authorization safety', () => {
    it('a legitimate duplicate from the same authorized actor returns the original result, and authorization runs again on the replay', async () => {
      const authorizeSpy = vi.spyOn(trust, 'authorize');
      const command = buildCommand({ name: 'CreateProject', payload: { name: 'X' } });

      const first = await service.execute(command);
      const second = await service.execute(command);

      expect(second.status).toBe('duplicate');
      expect(second.data).toEqual(first.data);
      // Idempotency never short-circuits authorization: both the original
      // delivery and the replay each triggered their own trust decision.
      expect(authorizeSpy).toHaveBeenCalledTimes(2);
    });

    it('an unauthorized actor cannot replay another actor commandId and retrieve its result', async () => {
      const command = buildCommand({ name: 'CreateProject', payload: { name: 'Confidential Project' } });
      const original = await service.execute(command);
      expect(original.status).toBe('applied');

      const replay = { ...command, actor: agentActor } as unknown as CeoCommandEnvelope;
      await expect(service.execute(replay)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });

      // A genuine retry by the original, authorized actor still returns the
      // original result afterwards — the failed replay didn't poison the cache.
      const retryByOriginalActor = await service.execute(command);
      expect(retryByOriginalActor.status).toBe('duplicate');
      expect(retryByOriginalActor.data).toEqual(original.data);
    });

    it('an unauthorized actor cannot retrieve another actor result via a shared idempotencyKey either', async () => {
      const idempotencyKey = `idem-${randomUUID()}`;
      const command = buildCommand({
        name: 'CreateProject',
        payload: { name: 'Confidential Project' },
        idempotencyKey,
      });
      const original = await service.execute(command);
      expect(original.status).toBe('applied');

      const replay = buildCommand({
        name: 'CreateProject',
        payload: { name: 'Confidential Project' },
        idempotencyKey,
        actor: agentActor,
      });
      await expect(service.execute(replay)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    });
  });

  describe('malformed input', () => {
    it('rejects a payload missing required fields', async () => {
      const command = buildCommand({ name: 'SelectOpportunity', payload: {} });
      await expect(service.execute(command)).rejects.toMatchObject({ code: 'MALFORMED_PAYLOAD' });
    });

    it('rejects an envelope missing actor', async () => {
      const command = { ...buildCommand({ name: 'CreateProject', payload: { name: 'X' } }), actor: undefined } as unknown as CeoCommandEnvelope;
      await expect(service.execute(command)).rejects.toMatchObject({ code: 'MALFORMED_PAYLOAD' });
    });
  });
});
