import { describe, expect, it } from 'vitest';
import {
  AgentContractSchema,
  OpportunitySchema,
  ProjectContractSchema,
  SCHEMA_VERSION,
  TaskContractSchema,
  parseContract,
  safeParseContract,
  type ContractHeader,
} from './index.js';

const at = '2026-09-10T00:00:00.000Z';

function header(id: string): ContractHeader {
  return {
    id,
    schemaVersion: SCHEMA_VERSION,
    createdAt: at,
    updatedAt: at,
    metadata: { labels: {}, annotations: {} },
  };
}

describe('AgentContract', () => {
  const valid = {
    ...header('agent-hdr-1'),
    kind: 'agent' as const,
    agentId: 'agent-growth-1',
    specialistId: 'growth.opportunity-research',
    status: 'idle' as const,
  };

  it('parses a minimal Agent — worker identity referencing a Specialist mandate by id only', () => {
    const parsed = parseContract(AgentContractSchema, valid);
    expect(parsed.specialistId).toBe('growth.opportunity-research');
    expect(parsed.capabilityIds).toEqual([]);
    // No mandate fields (mission, toolAllowlist, authorityClass, ...) are duplicated here.
    expect(parsed).not.toHaveProperty('mission');
    expect(parsed).not.toHaveProperty('toolAllowlist');
  });

  it('parses a fully-populated active Agent with current work references', () => {
    const parsed = parseContract(AgentContractSchema, {
      ...valid,
      name: 'Growth Opportunity Research Worker',
      department: 'Growth',
      capabilityIds: ['cap.growth.discovery'],
      status: 'active',
      lastSeenAt: at,
      currentProjectId: 'proj-1',
      currentTaskId: 'task-1',
      currentWorkPackageId: 'wp-1',
      currentAgentRunId: 'wp-1:corr-1',
    });
    expect(parsed.status).toBe('active');
    expect(parsed.currentWorkPackageId).toBe('wp-1');
  });

  it('rejects an invalid status', () => {
    const bad = safeParseContract(AgentContractSchema, { ...valid, status: 'sleeping' });
    expect(bad.success).toBe(false);
  });
});

describe('ProjectContract', () => {
  const valid = {
    ...header('proj-hdr-1'),
    kind: 'project' as const,
    projectId: 'proj-1',
    name: 'Healthcare SaaS Opportunity Build',
    status: 'Forming' as const,
  };

  it('parses a minimal Project', () => {
    expect(parseContract(ProjectContractSchema, valid).status).toBe('Forming');
  });

  it('parses a Project linked back to its source Opportunity and a registry codebase', () => {
    const parsed = parseContract(ProjectContractSchema, {
      ...valid,
      status: 'Active',
      owner: 'Growth Lead',
      sourceOpportunityId: 'opp-1',
      registryProjectId: 'nitrotickets-new',
    });
    expect(parsed.sourceOpportunityId).toBe('opp-1');
    expect(parsed.registryProjectId).toBe('nitrotickets-new');
  });

  it('rejects an invalid lifecycle status', () => {
    const bad = safeParseContract(ProjectContractSchema, { ...valid, status: 'Done' });
    expect(bad.success).toBe(false);
  });
});

describe('TaskContract — Agent assignment', () => {
  const valid = {
    ...header('task-hdr-1'),
    kind: 'task' as const,
    taskId: 'task-1',
    epicId: 'epic-1',
    projectId: 'proj-1',
    title: 'Research healthcare SaaS opportunities',
    description: 'Find and evidence candidate opportunities',
    status: 'Ready' as const,
    acceptanceCriteria: ['At least 2 evidenced findings'],
  };

  it('parses a Task with no Agent assigned yet', () => {
    const parsed = parseContract(TaskContractSchema, valid);
    expect(parsed.assignedAgentId).toBeUndefined();
  });

  it('parses a Task assigned to an Agent', () => {
    const parsed = parseContract(TaskContractSchema, { ...valid, assignedAgentId: 'agent-growth-1' });
    expect(parsed.assignedAgentId).toBe('agent-growth-1');
  });
});

describe('Opportunity — Project execution link', () => {
  const validScore = {
    problemSeverity: 80,
    demandEvidence: 70,
    abilityToPay: 60,
    reachability: 50,
    solutionFit: 75,
    competitiveGap: 40,
    deliveryFeasibility: 65,
    evidenceConfidence: 70,
    overall: 65,
    recommendation: 'outreach_ready' as const,
  };
  const valid = {
    id: 'opp-1',
    type: 'product' as const,
    title: 'Telehealth billing automation',
    geography: 'US',
    market: 'Healthcare SaaS',
    problemIds: ['prob-1'],
    score: validScore,
    evidenceRefs: ['ev-1'],
    status: 'discovered' as const,
    createdAt: at,
    updatedAt: at,
  };

  it('parses an Opportunity with no Project yet', () => {
    expect(OpportunitySchema.parse(valid).status).toBe('discovered');
  });

  it('accepts the project_created status transition — status alone, no projectId field', () => {
    const parsed = OpportunitySchema.parse({ ...valid, status: 'project_created' });
    expect(parsed.status).toBe('project_created');
  });

  it('accepts the new selected_for_execution status', () => {
    expect(OpportunitySchema.parse({ ...valid, status: 'selected_for_execution' }).status).toBe(
      'selected_for_execution',
    );
  });

  it('has no projectId field — the MySQL-persisted opportunity_opportunities table has no column for it, ' +
    'so a projectId here would silently fail to round-trip; rejecting it is a deliberate guard against ' +
    'reintroducing that persistence lie (see OpportunityStatusSchema doc comment)', () => {
    const result = OpportunitySchema.safeParse({ ...valid, status: 'project_created', projectId: 'proj-1' });
    expect(result.success).toBe(false);
  });

  it('the Opportunity -> Project relationship is instead recorded only in reverse, on ProjectContract.sourceOpportunityId', () => {
    const project = parseContract(ProjectContractSchema, {
      ...header('proj-hdr-link'),
      kind: 'project' as const,
      projectId: 'proj-1',
      name: 'Telehealth billing automation build',
      status: 'Forming' as const,
      sourceOpportunityId: valid.id,
    });
    expect(project.sourceOpportunityId).toBe('opp-1');
    // Finding "which project did this opportunity become" means querying the
    // Project store for sourceOpportunityId === opportunityId, not reading a
    // field off the Opportunity itself.
  });
});
