/**
 * Morning CEO brief — a pure reducer over data the dashboard already has.
 * Never invents cash, rankings, or completed work. Missing money stays unknown.
 */

import {
  DECIDABLE_OPPORTUNITY_STATUSES,
  PROMISING_SCORE_THRESHOLD,
  type AttentionCase,
  type CompanyPulse,
} from './company-derive';
import { isDemoAuditRecord, type AuditRecordLike } from './audit-story';
import type {
  AgentRunRecord,
  DashboardSummary,
  GateWaitRecord,
  OpportunityRecord,
} from './control-api';
import { isSeoGate } from './seo-owner';

export type BriefActionTone = 'critical' | 'action' | 'info';

export type BriefAction = {
  id: string;
  label: string;
  reason: string;
  href: string;
  tone: BriefActionTone;
};

export type MorningBrief = {
  companyState: 'broken' | 'needs_you' | 'operating' | 'idle';
  headline: string;
  actions: BriefAction[];
  last24h: {
    completedRuns: number;
    failedRuns: number;
    auditEvents: number;
    resolvedGates: number;
  };
  money: {
    cashStatus: 'unknown';
    cashLabel: string;
    pipelineMin: number | null;
    pipelineMax: number | null;
    currency: string | null;
    promisingWithEstimate: number;
  };
  waitingGates: number;
  seoApprovals: number;
  topOpportunities: Array<{ id: string; title: string; score: number; href: string }>;
  controlApi: { status: 'up' | 'down' };
  llm: { status: 'up' | 'down' | 'unknown'; label: string };
};

export type MorningBriefInput = {
  pulse: CompanyPulse;
  attentionCases: AttentionCase[];
  opportunities: OpportunityRecord[];
  gates: GateWaitRecord[];
  dashboard: DashboardSummary | null;
  agentRuns: AgentRunRecord[];
  auditRecords: AuditRecordLike[];
  controlApiUp: boolean;
  llm: { status: 'up' | 'down' | 'unknown'; label: string };
  now?: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function withinLast24h(iso: string | undefined, now: number): boolean {
  if (!iso) return false;
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return false;
  return now - ts <= DAY_MS;
}

function pickActions(input: MorningBriefInput): BriefAction[] {
  const actions: BriefAction[] = [];
  const seoGates = input.gates.filter((g) => isSeoGate(g.gateId));
  const otherGates = input.gates.filter((g) => !isSeoGate(g.gateId));
  const critical = input.attentionCases.filter((c) => c.severity === 'critical');
  const decisions = input.opportunities.filter(
    (o) => (o.score?.overall ?? 0) >= PROMISING_SCORE_THRESHOLD && DECIDABLE_OPPORTUNITY_STATUSES.has(o.status),
  );

  if (!input.controlApiUp) {
    actions.push({
      id: 'control-api-down',
      label: 'Control API is unreachable',
      reason: 'The company dashboard cannot load live work until control-api is up.',
      href: '/system-health',
      tone: 'critical',
    });
  }
  if (input.llm.status === 'down') {
    actions.push({
      id: 'llm-down',
      label: 'Local model is down',
      reason: input.llm.label,
      href: '/system-health',
      tone: 'critical',
    });
  }
  if (critical.length > 0) {
    actions.push({
      id: 'critical-attention',
      label: `${critical.length} critical item${critical.length === 1 ? '' : 's'} need investigation`,
      reason: critical[0]!.title,
      href: '/attention',
      tone: 'critical',
    });
  }
  if (seoGates.length > 0) {
    actions.push({
      id: 'seo-approve',
      label: `Approve ${seoGates.length} SEO fix${seoGates.length === 1 ? '' : 'es'}`,
      reason: 'Safe mechanical SEO changes are waiting for a Pass. You do not need SEO knowledge — read the one-sentence board, then approve.',
      href: seoGates.length === 1 ? `/gates#${seoGates[0]!.waitId}` : '/seo',
      tone: 'action',
    });
  }
  if (otherGates.length > 0) {
    actions.push({
      id: 'gates',
      label: `Review ${otherGates.length} waiting gate${otherGates.length === 1 ? '' : 's'}`,
      reason: 'Delivery cannot finish until you Pass or Fail these.',
      href: '/gates',
      tone: 'action',
    });
  }
  if (decisions.length > 0) {
    actions.push({
      id: 'decisions',
      label: `Decide on ${decisions.length} scored opportunit${decisions.length === 1 ? 'y' : 'ies'}`,
      reason: 'High-score opportunities are sitting in a decidable status.',
      href: '/decisions',
      tone: 'action',
    });
  }
  if (input.pulse.tasks.blocked > 0) {
    actions.push({
      id: 'blocked-tasks',
      label: `Unblock ${input.pulse.tasks.blocked} task${input.pulse.tasks.blocked === 1 ? '' : 's'}`,
      reason: 'Blocked work will not move without you.',
      href: '/company/tasks',
      tone: 'action',
    });
  }

  return actions.slice(0, 3);
}

function deriveMoney(opportunities: OpportunityRecord[]): MorningBrief['money'] {
  const promising = opportunities.filter(
    (o) => (o.score?.overall ?? 0) >= PROMISING_SCORE_THRESHOLD && !['rejected', 'lost', 'won'].includes(o.status),
  );
  const withEstimate = promising.filter((o) => o.estimatedValueMin != null || o.estimatedValueMax != null);
  let pipelineMin: number | null = null;
  let pipelineMax: number | null = null;
  let currency: string | null = null;
  for (const o of withEstimate) {
    if (o.estimatedValueMin != null) pipelineMin = (pipelineMin ?? 0) + o.estimatedValueMin;
    if (o.estimatedValueMax != null) pipelineMax = (pipelineMax ?? 0) + o.estimatedValueMax;
    if (!currency && o.currency) currency = o.currency;
  }
  return {
    cashStatus: 'unknown',
    cashLabel: 'No invoices recorded',
    pipelineMin,
    pipelineMax,
    currency,
    promisingWithEstimate: withEstimate.length,
  };
}

export function deriveMorningBrief(input: MorningBriefInput): MorningBrief {
  const now = input.now ?? Date.now();
  const actions = pickActions(input);
  const seoApprovals = input.gates.filter((g) => isSeoGate(g.gateId)).length;
  const completedRuns = input.agentRuns.filter(
    (r) => r.status === 'completed' && withinLast24h(r.updatedAt, now),
  ).length;
  const failedRuns = input.agentRuns.filter((r) => r.status === 'failed' && withinLast24h(r.updatedAt, now)).length;
  const auditEvents = input.auditRecords.filter(
    (r) => !isDemoAuditRecord(r) && withinLast24h(r.occurredAt, now),
  ).length;

  let companyState: MorningBrief['companyState'] = 'idle';
  if (!input.controlApiUp || input.llm.status === 'down') companyState = 'broken';
  else if (actions.length > 0) companyState = 'needs_you';
  else if (input.pulse.agents.working > 0 || input.pulse.projects.active > 0) companyState = 'operating';

  const headline =
    companyState === 'broken'
      ? !input.controlApiUp
        ? 'Control API is down — live company data cannot be trusted until it is reachable.'
        : 'The local model is unreachable. Specialists will fail closed until LM Studio is up.'
      : actions.length > 0
        ? `${actions.length} thing${actions.length === 1 ? '' : 's'} need you in the next 15 minutes.`
        : companyState === 'operating'
          ? 'Company is operating. Nothing needs you right now.'
          : 'Company is idle. No agents or projects are running.';

  const topOpportunities = [...input.opportunities]
    .filter((o) => o.score != null && !['rejected', 'lost'].includes(o.status))
    .sort((a, b) => (b.score?.overall ?? 0) - (a.score?.overall ?? 0))
    .slice(0, 3)
    .map((o) => ({
      id: o.id,
      title: o.title,
      score: o.score?.overall ?? 0,
      href: `/company/opportunities?open=${o.id}`,
    }));

  return {
    companyState,
    headline,
    actions,
    last24h: {
      completedRuns,
      failedRuns,
      auditEvents,
      resolvedGates: input.dashboard?.resolvedToday ?? 0,
    },
    money: deriveMoney(input.opportunities),
    waitingGates: input.gates.length,
    seoApprovals,
    topOpportunities,
    controlApi: { status: input.controlApiUp ? 'up' : 'down' },
    llm: input.llm,
  };
}
