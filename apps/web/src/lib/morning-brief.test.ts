import { describe, expect, it } from 'vitest';
import { deriveMorningBrief } from './morning-brief';
import type { AttentionCase, CompanyPulse } from './company-derive';
import type { AgentRunRecord, GateWaitRecord, OpportunityRecord } from './control-api';

const pulse = (over: Partial<CompanyPulse> = {}): CompanyPulse => ({
  opportunities: { total: 0, promising: 0, selected: 0 },
  projects: { total: 0, active: 0, blocked: 0 },
  agents: { total: 0, working: 0, idle: 0, paused: 0 },
  tasks: { total: 0, active: 0, blocked: 0 },
  decisionsRequired: 0,
  ...over,
});

const gate = (over: Partial<GateWaitRecord> = {}): GateWaitRecord => ({
  waitId: 'wait-1',
  gateId: 'gate-eng-school-app',
  execId: 'exec-1',
  workPackageId: 'wp-1',
  stageFrom: 'Review',
  stageTo: 'Apply',
  status: 'Waiting',
  requiredApprovers: ['human.approver'],
  recordedApprovers: [],
  humanRequired: true,
  requestedAt: '2026-09-04T00:00:00.000Z',
  ...over,
});

const opportunity = (over: Partial<OpportunityRecord> = {}): OpportunityRecord => ({
  id: 'opp-1',
  type: 'niche',
  title: 'Clinic booking site',
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
    overall: 88,
    recommendation: 'outreach_ready',
  },
  estimatedValueMin: 800,
  estimatedValueMax: 2000,
  currency: 'USD',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  ...over,
});

const run = (over: Partial<AgentRunRecord> = {}): AgentRunRecord => ({
  workPackageId: 'wp-1',
  agentId: 'agent-1',
  correlationId: 'corr-1',
  status: 'completed',
  currentAction: 'idle',
  startedAt: '2026-09-04T10:00:00.000Z',
  updatedAt: '2026-09-04T11:00:00.000Z',
  toolCalls: [],
  decisions: [],
  actionLog: [],
  failures: [],
  ...over,
});

const attention = (over: Partial<AttentionCase> = {}): AttentionCase => ({
  id: 'case-1',
  category: 'repeated_failure',
  severity: 'critical',
  severityReason: 'Blocks active work',
  title: 'Growth-01 failed 3 times',
  whatHappened: 'Tool error',
  source: [],
  evidence: [],
  currentState: [],
  recommendedNextAction: 'Investigate',
  ceoActionNeeded: true,
  occurredAt: '2026-09-04T11:00:00.000Z',
  technical: {},
  ...over,
});

const now = Date.parse('2026-09-04T12:00:00.000Z');

describe('deriveMorningBrief', () => {
  it('keeps cash unknown and never invents invoices', () => {
    const brief = deriveMorningBrief({
      pulse: pulse(),
      attentionCases: [],
      opportunities: [opportunity()],
      gates: [],
      dashboard: { pendingGates: 0, workPackagesAwaitingReview: 0, resolvedToday: 0 },
      agentRuns: [],
      auditRecords: [],
      controlApiUp: true,
      llm: { status: 'up', label: 'REACHABLE' },
      now,
    });
    expect(brief.money.cashStatus).toBe('unknown');
    expect(brief.money.cashLabel).toBe('No invoices recorded');
    expect(brief.money.pipelineMin).toBe(800);
    expect(brief.money.pipelineMax).toBe(2000);
    expect(brief.money.currency).toBe('USD');
  });

  it('caps actions at three and prefers broken runtime first', () => {
    const brief = deriveMorningBrief({
      pulse: pulse({ tasks: { total: 2, active: 1, blocked: 1 }, decisionsRequired: 1 }),
      attentionCases: [attention()],
      opportunities: [opportunity()],
      gates: [gate({ gateId: 'gate-seo-cursive-generator', waitId: 'seo-wait' }), gate()],
      dashboard: null,
      agentRuns: [],
      auditRecords: [],
      controlApiUp: false,
      llm: { status: 'down', label: 'UNREACHABLE' },
      now,
    });
    expect(brief.companyState).toBe('broken');
    expect(brief.actions).toHaveLength(3);
    expect(brief.actions[0]?.id).toBe('control-api-down');
    expect(brief.actions[1]?.id).toBe('llm-down');
    expect(brief.actions[2]?.id).toBe('critical-attention');
  });

  it('points SEO approvals at the owner board when more than one gate waits', () => {
    const brief = deriveMorningBrief({
      pulse: pulse(),
      attentionCases: [],
      opportunities: [],
      gates: [
        gate({ waitId: 'a', gateId: 'gate-seo-cursive-generator' }),
        gate({ waitId: 'b', gateId: 'gate-seo-flow-tool-works' }),
      ],
      dashboard: null,
      agentRuns: [],
      auditRecords: [],
      controlApiUp: true,
      llm: { status: 'unknown', label: 'not probed' },
      now,
    });
    expect(brief.seoApprovals).toBe(2);
    expect(brief.actions[0]?.href).toBe('/seo');
    expect(brief.companyState).toBe('needs_you');
  });

  it('counts completed runs only inside the last 24 hours', () => {
    const brief = deriveMorningBrief({
      pulse: pulse({ agents: { total: 1, working: 1, idle: 0, paused: 0 }, projects: { total: 1, active: 1, blocked: 0 } }),
      attentionCases: [],
      opportunities: [],
      gates: [],
      dashboard: { pendingGates: 0, workPackagesAwaitingReview: 0, resolvedToday: 2 },
      agentRuns: [
        run(),
        run({ workPackageId: 'wp-old', updatedAt: '2026-09-01T00:00:00.000Z' }),
        run({ workPackageId: 'wp-fail', status: 'failed', updatedAt: '2026-09-04T11:30:00.000Z' }),
      ],
      auditRecords: [],
      controlApiUp: true,
      llm: { status: 'up', label: 'REACHABLE' },
      now,
    });
    expect(brief.last24h.completedRuns).toBe(1);
    expect(brief.last24h.failedRuns).toBe(1);
    expect(brief.last24h.resolvedGates).toBe(2);
    expect(brief.companyState).toBe('operating');
    expect(brief.actions).toHaveLength(0);
    expect(brief.headline).toMatch(/operating/i);
  });
});
