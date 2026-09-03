import { describe, expect, it } from 'vitest';
import {
  deriveActivityFeed,
  deriveAttention,
  deriveCompanyPulse,
  deriveCompanySummary,
  deriveWhileYouWereAway,
  type AuditRecordWithDetail,
} from './company-derive.js';
import type { AgentRecord, AgentRunRecord, OpportunityRecord, WorkProjectRecord, WorkTaskRecord } from './control-api.js';

const opportunity = (over: Partial<OpportunityRecord> = {}): OpportunityRecord => ({
  id: 'opp-1',
  type: 'niche',
  title: 'Healthcare Scheduling SaaS',
  geography: 'US',
  market: 'healthcare',
  status: 'validated',
  score: {
    problemSeverity: 80,
    demandEvidence: 75,
    abilityToPay: 70,
    reachability: 60,
    solutionFit: 70,
    competitiveGap: 65,
    deliveryFeasibility: 80,
    evidenceConfidence: 75,
    overall: 91,
    recommendation: 'outreach_ready',
  },
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  ...over,
});

const project = (over: Partial<WorkProjectRecord> = {}): WorkProjectRecord => ({
  projectId: 'proj-1',
  name: 'Healthcare Scheduling SaaS',
  status: 'Active',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  ...over,
});

const task = (over: Partial<WorkTaskRecord> = {}): WorkTaskRecord => ({
  taskId: 'task-1',
  epicId: 'epic-1',
  projectId: 'proj-1',
  title: 'Pricing research',
  description: 'Research competitor pricing',
  status: 'InProgress',
  acceptanceCriteria: [],
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  ...over,
});

const agent = (over: Partial<AgentRecord> = {}): AgentRecord => ({
  agentId: 'agent-1',
  specialistId: 'growth.opportunity-research',
  name: 'Growth-01',
  status: 'active',
  controlState: 'active',
  lastSeenAt: '2026-09-01T00:00:00.000Z',
  ...over,
});

describe('deriveCompanyPulse', () => {
  it('counts promising opportunities, active projects, working agents and blocked tasks from real records', () => {
    const pulse = deriveCompanyPulse(
      [agent(), agent({ agentId: 'agent-2', status: 'idle' }), agent({ agentId: 'agent-3', controlState: 'paused' })],
      [project(), project({ projectId: 'proj-2', status: 'Paused' })],
      [task(), task({ taskId: 'task-2', status: 'Blocked' })],
      [opportunity(), opportunity({ id: 'opp-2', status: 'rejected', score: undefined })],
    );

    expect(pulse.opportunities).toEqual({ total: 2, promising: 1, selected: 0 });
    expect(pulse.projects).toEqual({ total: 2, active: 1, blocked: 1 });
    expect(pulse.agents).toEqual({ total: 3, working: 1, idle: 1, paused: 1 });
    expect(pulse.tasks.blocked).toBe(1);
    expect(pulse.decisionsRequired).toBe(1);
  });
});

describe('deriveCompanySummary', () => {
  it('produces a plain-language sentence and flags attention items', () => {
    const pulse = deriveCompanyPulse([agent()], [project()], [task()], [opportunity()]);
    const summary = deriveCompanySummary(pulse, 2);
    expect(summary).toContain('validating 1 promising opportunity');
    expect(summary).toContain('1 agent working');
    expect(summary).toContain('2 items require your attention');
  });

  it('says nothing requires attention when there is nothing to flag', () => {
    const pulse = deriveCompanyPulse([], [], [], []);
    expect(deriveCompanySummary(pulse, 0)).toContain('Nothing requires your attention');
  });
});

describe('deriveAttention', () => {
  it('surfaces a critical alert for an agent with repeated failures', () => {
    const runs: AgentRunRecord[] = [
      {
        workPackageId: 'wp-1',
        agentId: 'agent-1',
        correlationId: 'corr-1',
        status: 'failed',
        currentAction: 'idle',
        startedAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:10:00.000Z',
        toolCalls: [],
        decisions: [],
        actionLog: [],
        failures: [
          { source: 'tool', message: 'timeout', at: '2026-09-01T00:05:00.000Z' },
          { source: 'run', message: 'gave up after 2 retries', at: '2026-09-01T00:10:00.000Z' },
        ],
      },
    ];
    const items = deriveAttention([agent({ name: 'Engineering-01' })], runs, [], [], []);
    expect(items[0]).toMatchObject({ severity: 'critical', title: 'Engineering-01 failed 2 times' });
  });

  it('surfaces a decision-required alert for a high-scoring undecided opportunity', () => {
    const items = deriveAttention([], [], [], [], [opportunity()]);
    expect(items[0]).toMatchObject({ severity: 'decision', title: 'Healthcare Scheduling SaaS' });
    expect(items[0]?.detail).toContain('91/100');
  });

  it('surfaces a blocked alert for a blocked task and links to its project', () => {
    const items = deriveAttention([], [], [project()], [task({ status: 'Blocked' })], []);
    expect(items[0]).toMatchObject({ severity: 'blocked', href: '/company/projects/proj-1' });
  });

  it('orders critical before decision before blocked', () => {
    const runs: AgentRunRecord[] = [
      {
        workPackageId: 'wp-1',
        agentId: 'agent-1',
        correlationId: 'corr-1',
        status: 'failed',
        currentAction: 'idle',
        startedAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
        toolCalls: [],
        decisions: [],
        actionLog: [],
        failures: [
          { source: 'tool', message: 'a', at: '2026-09-01T00:00:00.000Z' },
          { source: 'tool', message: 'b', at: '2026-09-01T00:00:00.000Z' },
        ],
      },
    ];
    const items = deriveAttention([agent()], runs, [project()], [task({ status: 'Blocked' })], [opportunity()]);
    expect(items.map((i) => i.severity)).toEqual(['critical', 'decision', 'blocked']);
  });
});

describe('deriveActivityFeed', () => {
  it('translates a SelectOpportunity command into a human sentence and excludes demo rows', () => {
    const records: AuditRecordWithDetail[] = [
      {
        action: 'SelectOpportunity',
        actor: 'human.ceo',
        resourceType: 'opportunity',
        resourceId: 'opp-1',
        outcome: 'success',
        occurredAt: '2026-09-03T21:58:00.000Z',
        detail: { payload: { opportunityId: 'opp-1' } },
      },
      {
        action: 'agent.run.completed',
        actor: 'eng.app-delivery',
        resourceType: 'work_package',
        resourceId: 'wp-e2e-1',
        outcome: 'success',
        correlationId: 'corr-e2e-flow',
        occurredAt: '2026-09-03T21:57:00.000Z',
      },
    ];
    const feed = deriveActivityFeed(records, [opportunity()], [], [], []);
    expect(feed).toHaveLength(1);
    expect(feed[0]?.headline).toBe('CEO selected "Healthcare Scheduling SaaS"');
    expect(feed[0]?.technical.action).toBe('SelectOpportunity');
  });

  it('sorts newest first', () => {
    const records: AuditRecordWithDetail[] = [
      {
        action: 'PauseAgent',
        actor: 'human.ceo',
        resourceType: 'agent',
        resourceId: 'agent-1',
        outcome: 'success',
        occurredAt: '2026-09-03T10:00:00.000Z',
        detail: { payload: { agentId: 'agent-1' } },
      },
      {
        action: 'ResumeAgent',
        actor: 'human.ceo',
        resourceType: 'agent',
        resourceId: 'agent-1',
        outcome: 'success',
        occurredAt: '2026-09-03T11:00:00.000Z',
        detail: { payload: { agentId: 'agent-1' } },
      },
    ];
    const feed = deriveActivityFeed(records, [], [], [], [agent()]);
    expect(feed.map((e) => e.technical.action)).toEqual(['ResumeAgent', 'PauseAgent']);
  });
});

describe('deriveWhileYouWereAway', () => {
  it('counts real activity since a timestamp', () => {
    const audit: AuditRecordWithDetail[] = [
      {
        action: 'SelectOpportunity',
        actor: 'human.ceo',
        resourceType: 'opportunity',
        resourceId: 'opp-1',
        outcome: 'success',
        occurredAt: '2026-09-03T12:00:00.000Z',
      },
    ];
    const runs: AgentRunRecord[] = [
      {
        workPackageId: 'wp-1',
        agentId: 'agent-1',
        correlationId: 'corr-1',
        status: 'completed',
        currentAction: 'idle',
        startedAt: '2026-09-03T10:00:00.000Z',
        updatedAt: '2026-09-03T12:00:00.000Z',
        finishedAt: '2026-09-03T12:00:00.000Z',
        toolCalls: [],
        decisions: [],
        actionLog: [],
        failures: [],
      },
    ];
    const result = deriveWhileYouWereAway(audit, runs, '2026-09-03T00:00:00.000Z');
    expect(result.agentRunsCompleted).toBe(1);
    expect(result.opportunitiesSelected).toBe(1);
    expect(result.decisionsMade).toBe(1);
    expect(result.narrative).toContain('completed');
  });

  it('says nothing happened when there is no recent activity', () => {
    const result = deriveWhileYouWereAway([], [], '2026-09-03T00:00:00.000Z');
    expect(result.narrative).toBe('Nothing happened while you were away.');
  });
});
