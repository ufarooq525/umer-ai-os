import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import { InMemoryAgentRegistryStore, type AgentSnapshot } from '@umer/observability';
import { InMemoryOpportunityPersistence } from '@umer/opportunity-intelligence';
import type { Opportunity } from '@umer/contracts';
import { createControlApiServer, createControlApiState } from './server.js';
import { InMemoryProjectStore } from './project-store.js';
import { InMemoryTaskStore } from './task-store.js';

async function request(server: Server, path: string): Promise<{ status: number; json: unknown }> {
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('server not listening');
  }
  const response = await fetch(`http://127.0.0.1:${address.port}${path}`);
  return { status: response.status, json: await response.json() };
}

const activeAgent: AgentSnapshot = {
  agentId: 'agent-growth-1',
  specialistId: 'growth.opportunity-research',
  name: 'Growth Opportunity Research Worker',
  department: 'Growth',
  capabilityIds: ['cap.growth.discovery'],
  status: 'active',
  lastSeenAt: '2026-09-10T00:00:00.000Z',
  currentWorkPackageId: 'wp-1',
  currentTaskIds: ['task-1'],
  currentAgentRunId: 'wp-1:corr-1',
};

const idleAgent: AgentSnapshot = {
  agentId: 'agent-eng-1',
  specialistId: 'eng.app-delivery',
  department: 'Engineering',
  status: 'idle',
  lastSeenAt: '2026-09-10T00:01:00.000Z',
};

describe('control-api — Company Operating Model read endpoints', () => {
  let server: Server;

  beforeAll(async () => {
    const state = await createControlApiState();

    state.agentRegistry = new InMemoryAgentRegistryStore();
    await state.agentRegistry.upsert(activeAgent);
    await state.agentRegistry.upsert(idleAgent);

    state.projectStore = new InMemoryProjectStore();
    const project = await state.projectStore.create({ name: 'Healthcare SaaS Build', owner: 'Growth Lead' }, 'corr-1');
    await state.projectStore.updateStatus(project.projectId, 'Active', 'corr-1');

    state.taskStore = new InMemoryTaskStore();
    const task = await state.taskStore.create(
      {
        epicId: 'epic-1',
        projectId: project.projectId,
        title: 'Research healthcare SaaS opportunities',
        description: 'Find and evidence candidate opportunities',
        acceptanceCriteria: ['At least 2 evidenced findings'],
      },
      'corr-1',
    );
    await state.taskStore.assign(task.taskId, 'agent-growth-1', 'corr-1');
    // Point the seeded agent's current task at the real created task id so the
    // currentProjectId join resolves in the "one agent, currently working" test.
    activeAgent.currentTaskIds = [task.taskId];
    await state.agentRegistry.upsert(activeAgent);

    const opportunity: Opportunity = {
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
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    };
    const rejectedOpportunity: Opportunity = { ...opportunity, id: 'opp-2', status: 'rejected' };
    state.opportunityReader = new InMemoryOpportunityPersistence();
    await state.opportunityReader.saveOpportunity(opportunity);
    await state.opportunityReader.saveOpportunity(rejectedOpportunity);

    server = createControlApiServer(state);
    await new Promise<void>((resolve) => server.listen(0, resolve));
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  });

  describe('GET /v1/agents', () => {
    it('lists agents and filters by status/department/specialist', async () => {
      const all = await request(server, '/v1/agents');
      expect(all.status).toBe(200);
      expect((all.json as { agents: unknown[] }).agents).toHaveLength(2);

      const active = await request(server, '/v1/agents?status=active');
      expect((active.json as { agents: AgentSnapshot[] }).agents).toHaveLength(1);

      const growth = await request(server, '/v1/agents?department=Growth');
      expect((growth.json as { agents: AgentSnapshot[] }).agents.map((a) => a.agentId)).toEqual(['agent-growth-1']);

      const bySpecialist = await request(server, '/v1/agents?specialist=eng.app-delivery');
      expect((bySpecialist.json as { agents: AgentSnapshot[] }).agents.map((a) => a.agentId)).toEqual(['agent-eng-1']);
    });

    it('(12) CEO query: "which project is this agent working on" resolves currentProjectId via the Task store', async () => {
      const { json } = await request(server, '/v1/agents/agent-growth-1');
      const agent = json as AgentSnapshot & { currentProjectId?: string };
      expect(agent.status).toBe('active');
      expect(agent.currentProjectId).toBeDefined();
    });

    it('404s for an unknown agent', async () => {
      const { status } = await request(server, '/v1/agents/does-not-exist');
      expect(status).toBe(404);
    });
  });

  describe('GET /v1/work-projects', () => {
    it('lists Work Management Projects, distinct from the registry /v1/projects route', async () => {
      const workProjects = await request(server, '/v1/work-projects');
      expect(workProjects.status).toBe(200);
      const projects = (workProjects.json as { projects: { name: string }[] }).projects;
      expect(projects).toHaveLength(1);
      expect(projects[0]?.name).toBe('Healthcare SaaS Build');

      // /v1/projects still serves the pre-existing @umer/registry codebase catalog, unchanged.
      const registryProjects = await request(server, '/v1/projects');
      expect(registryProjects.status).toBe(200);
      expect(registryProjects.json).toHaveProperty('projectsRoot');
    });

    it('filters by status and owner', async () => {
      const active = await request(server, '/v1/work-projects?status=Active');
      expect((active.json as { projects: unknown[] }).projects).toHaveLength(1);
      const forming = await request(server, '/v1/work-projects?status=Forming');
      expect((forming.json as { projects: unknown[] }).projects).toHaveLength(0);
      const owned = await request(server, '/v1/work-projects?owner=Growth+Lead');
      expect((owned.json as { projects: unknown[] }).projects).toHaveLength(1);
    });

    it('404s for an unknown work-project', async () => {
      const { status } = await request(server, '/v1/work-projects/does-not-exist');
      expect(status).toBe(404);
    });
  });

  describe('GET /v1/tasks', () => {
    it('lists tasks and filters by project/agent/status', async () => {
      const all = await request(server, '/v1/tasks');
      expect((all.json as { tasks: unknown[] }).tasks).toHaveLength(1);

      const byAgent = await request(server, '/v1/tasks?agent=agent-growth-1');
      expect((byAgent.json as { tasks: unknown[] }).tasks).toHaveLength(1);

      const byStatus = await request(server, '/v1/tasks?status=Done');
      expect((byStatus.json as { tasks: unknown[] }).tasks).toHaveLength(0);
    });

    it('404s for an unknown task', async () => {
      const { status } = await request(server, '/v1/tasks/does-not-exist');
      expect(status).toBe(404);
    });
  });

  describe('GET /v1/opportunities', () => {
    it('lists opportunities from the Opportunity Intelligence read model and filters by status', async () => {
      const all = await request(server, '/v1/opportunities');
      expect(all.status).toBe(200);
      expect((all.json as { opportunities: unknown[] }).opportunities).toHaveLength(2);

      const discovered = await request(server, '/v1/opportunities?status=discovered');
      expect((discovered.json as { opportunities: { id: string }[] }).opportunities.map((o) => o.id)).toEqual(['opp-1']);
    });

    it('returns a single opportunity by id', async () => {
      const { status, json } = await request(server, '/v1/opportunities/opp-1');
      expect(status).toBe(200);
      expect((json as { title: string }).title).toBe('Telehealth billing automation');
    });

    it('404s for an unknown opportunity', async () => {
      const { status } = await request(server, '/v1/opportunities/does-not-exist');
      expect(status).toBe(404);
    });
  });
});
