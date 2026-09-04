import { describe, expect, it } from 'vitest';
import {
  deriveActivityFeed,
  deriveAttentionCases,
  deriveCompanyPulse,
  deriveCompanyStory,
  deriveLiveActivity,
  deriveWhileYouWereAway,
  type AuditRecordWithDetail,
} from './company-derive';
import type { AgentRecord, AgentRunRecord, OpportunityRecord, WorkProjectRecord, WorkTaskRecord } from './control-api';

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

const run = (over: Partial<AgentRunRecord> = {}): AgentRunRecord => ({
  workPackageId: 'wp-1',
  agentId: 'agent-1',
  correlationId: 'corr-1',
  status: 'running',
  currentAction: 'idle',
  startedAt: '2026-09-03T00:00:00.000Z',
  updatedAt: '2026-09-03T00:00:00.000Z',
  toolCalls: [],
  decisions: [],
  actionLog: [],
  failures: [],
  ...over,
});

const NOW = new Date('2026-09-03T12:00:00.000Z').getTime();

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

describe('deriveAttentionCases', () => {
  it('aggregates every decidable high-score opportunity into ONE case, not one per opportunity', () => {
    const opportunities = Array.from({ length: 52 }, (_, i) =>
      opportunity({ id: `opp-${i}`, title: `Opportunity ${i}`, status: 'validated' }),
    );
    const cases = deriveAttentionCases([], [], [], [], opportunities, NOW);
    const decisionCases = cases.filter((c) => c.category === 'decision_required');
    expect(decisionCases).toHaveLength(1);
    expect(decisionCases[0]?.title).toBe('52 opportunities awaiting your decision');
    expect(decisionCases[0]?.source).toHaveLength(5);
  });

  it('marks the decision case high severity when any opportunity scores 85+', () => {
    const cases = deriveAttentionCases([], [], [], [], [opportunity()], NOW);
    expect(cases[0]).toMatchObject({ category: 'decision_required', severity: 'high' });
    expect(cases[0]?.severityReason).toContain('85+');
  });

  it('surfaces a critical repeated_failure case for an agent with 2+ failures, with a real source chain', () => {
    const failingRun = run({
      failures: [
        { source: 'tool', message: 'timeout', at: '2026-09-03T00:05:00.000Z' },
        { source: 'run', message: 'gave up after 2 retries', at: '2026-09-03T00:10:00.000Z' },
      ],
    });
    const cases = deriveAttentionCases(
      [agent({ name: 'Engineering-01' })],
      [failingRun],
      [project()],
      [task({ assignedAgentId: 'agent-1', status: 'InProgress' })],
      [],
      NOW,
    );
    const failureCase = cases.find((c) => c.category === 'repeated_failure');
    expect(failureCase).toMatchObject({ severity: 'critical', title: 'Engineering-01 failed 2 times' });
    expect(failureCase?.severityReason).toContain('1 active task');
    expect(failureCase?.source.some((s) => s.type === 'project')).toBe(true);
    expect(failureCase?.evidence).toHaveLength(2);
  });

  it('flags a run that has been running well past the staleness threshold', () => {
    const staleRun = run({ status: 'running', startedAt: '2026-09-03T11:00:00.000Z' }); // 1h before NOW
    const cases = deriveAttentionCases([agent()], [staleRun], [], [], [], NOW);
    const waiting = cases.find((c) => c.category === 'waiting_too_long');
    expect(waiting).toBeDefined();
    expect(waiting?.title).toContain('Growth-01 has been running for');
  });

  it('does not flag a run within the staleness threshold', () => {
    const freshRun = run({ status: 'running', startedAt: '2026-09-03T11:55:00.000Z' }); // 5m before NOW
    const cases = deriveAttentionCases([agent()], [freshRun], [], [], [], NOW);
    expect(cases.filter((c) => c.category === 'waiting_too_long')).toHaveLength(0);
  });

  it('never produces a blocked/dependency case — that backend state does not exist', () => {
    const cases = deriveAttentionCases(
      [],
      [],
      [project()],
      [task({ status: 'Blocked' })],
      [],
      NOW,
    );
    expect(cases.every((c) => (c.category as string) !== 'blocked')).toBe(true);
  });

  it('orders critical before high before medium', () => {
    const failingRun = run({
      status: 'failed',
      failures: [
        { source: 'tool', message: 'a', at: '2026-09-03T00:00:00.000Z' },
        { source: 'tool', message: 'b', at: '2026-09-03T00:00:00.000Z' },
      ],
    });
    const cases = deriveAttentionCases([agent()], [failingRun], [], [], [opportunity()], NOW);
    expect(cases.map((c) => c.severity)).toEqual(['critical', 'high']);
  });
});

describe('deriveCompanyStory', () => {
  it('names the top project and folds in critical attention count', () => {
    const pulse = deriveCompanyPulse([agent()], [project()], [task()], [opportunity()]);
    const cases = deriveAttentionCases(
      [agent()],
      [run({ failures: [{ source: 'tool', message: 'x', at: '2026-09-03T00:00:00.000Z' }, { source: 'tool', message: 'y', at: '2026-09-03T00:00:00.000Z' }] })],
      [project()],
      [task()],
      [],
      NOW,
    );
    const story = deriveCompanyStory(pulse, cases, [project()], [task()], [agent()]);
    expect(story).toContain('validating 1 high-potential opportunity');
    expect(story).toContain('"Healthcare Scheduling SaaS" is the highest-priority project');
    expect(story).toContain('critical issue');
  });

  it('says operations are running normally when there is nothing to flag', () => {
    const pulse = deriveCompanyPulse([], [], [], []);
    const story = deriveCompanyStory(pulse, [], [], [], []);
    expect(story).toContain('running normally');
  });
});

describe('deriveLiveActivity', () => {
  it('merges actionLog entries across runs, newest first, attributed to the real agent name', () => {
    const runs: AgentRunRecord[] = [
      run({
        workPackageId: 'wp-1',
        agentId: 'agent-1',
        actionLog: [
          { at: '2026-09-03T00:00:00.000Z', event: 'agent.run.started', summary: 'Run started for specialist growth.opportunity-research' },
          { at: '2026-09-03T00:01:00.000Z', event: 'agent.tool.completed', summary: 'Tool "search_web" completed in 340ms' },
        ],
      }),
    ];
    const entries = deriveLiveActivity(runs, [agent({ name: 'Growth-01' })]);
    expect(entries).toHaveLength(2);
    expect(entries[0]?.summary).toContain('search_web');
    expect(entries[0]?.agentLabel).toBe('Growth-01');
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
      run({ status: 'completed', finishedAt: '2026-09-03T12:00:00.000Z' }),
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
