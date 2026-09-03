/**
 * Presentation-layer derivations for the CEO Control Center. Every function
 * here is a pure reducer over real read-model data already fetched from
 * control-api (@see control-api.ts) — nothing here invents entities, counts,
 * or reasoning. Where a signal genuinely doesn't exist yet (e.g. a stored
 * decision confidence score), the caller simply omits it rather than this
 * module fabricating one.
 */

import { describeAuditRecord, isDemoAuditRecord, type AuditRecordLike } from './audit-story';
import type {
  AgentRecord,
  AgentRunRecord,
  OpportunityRecord,
  WorkProjectRecord,
  WorkTaskRecord,
} from './control-api';

function plural(n: number, word: string, pluralWord = `${word}s`): string {
  return `${n} ${n === 1 ? word : pluralWord}`;
}

// --- Company Pulse ----------------------------------------------------------

export type CompanyPulse = {
  opportunities: { total: number; promising: number; selected: number };
  projects: { total: number; active: number; blocked: number };
  agents: { total: number; working: number; idle: number; paused: number };
  tasks: { total: number; active: number; blocked: number };
  decisionsRequired: number;
};

const PROMISING_SCORE_THRESHOLD = 70;
const DECIDABLE_OPPORTUNITY_STATUSES = new Set(['researching', 'validated', 'outreach_ready', 'in_sales']);
const ACTIVE_TASK_STATUSES = new Set(['Ready', 'Assigned', 'InProgress', 'InReview']);

export function deriveCompanyPulse(
  agents: AgentRecord[],
  projects: WorkProjectRecord[],
  tasks: WorkTaskRecord[],
  opportunities: OpportunityRecord[],
): CompanyPulse {
  const promising = opportunities.filter(
    (o) => (o.score?.overall ?? 0) >= PROMISING_SCORE_THRESHOLD && !['rejected', 'lost', 'won'].includes(o.status),
  );
  const decisionsRequired = opportunities.filter(
    (o) => (o.score?.overall ?? 0) >= PROMISING_SCORE_THRESHOLD && DECIDABLE_OPPORTUNITY_STATUSES.has(o.status),
  ).length;

  return {
    opportunities: {
      total: opportunities.length,
      promising: promising.length,
      selected: opportunities.filter((o) => o.status === 'selected_for_execution' || o.status === 'project_created')
        .length,
    },
    projects: {
      total: projects.length,
      active: projects.filter((p) => p.status === 'Active').length,
      // No dedicated "blocked" project status exists — Paused is the closest real signal (a project stalled on purpose or by exception).
      blocked: projects.filter((p) => p.status === 'Paused').length,
    },
    agents: {
      total: agents.length,
      working: agents.filter((a) => a.status === 'active' && a.controlState === 'active').length,
      idle: agents.filter((a) => a.status === 'idle' && a.controlState === 'active').length,
      paused: agents.filter((a) => a.controlState === 'paused').length,
    },
    tasks: {
      total: tasks.length,
      active: tasks.filter((t) => ACTIVE_TASK_STATUSES.has(t.status)).length,
      blocked: tasks.filter((t) => t.status === 'Blocked').length,
    },
    decisionsRequired,
  };
}

export function deriveCompanySummary(pulse: CompanyPulse, attentionCount: number): string {
  const parts: string[] = [];

  if (pulse.opportunities.promising > 0) {
    parts.push(
      `validating ${plural(pulse.opportunities.promising, 'promising opportunity', 'promising opportunities')}` +
        (pulse.projects.active > 0 ? ` across ${plural(pulse.projects.active, 'active project')}` : ''),
    );
  } else if (pulse.projects.active > 0) {
    parts.push(`running ${plural(pulse.projects.active, 'active project')}`);
  }

  if (pulse.agents.working > 0) {
    parts.push(`${plural(pulse.agents.working, 'agent')} working`);
  } else if (pulse.agents.total > 0) {
    parts.push('no agents currently working');
  }

  const lead = parts.length > 0 ? `The company is currently ${parts.join(', ')}.` : 'The company has no active work yet.';
  const tail =
    attentionCount > 0
      ? ` ${plural(attentionCount, 'item')} require${attentionCount === 1 ? 's' : ''} your attention.`
      : ' Nothing requires your attention right now.';

  return lead + tail;
}

// --- CEO Attention -----------------------------------------------------------

export type AttentionSeverity = 'critical' | 'decision' | 'blocked';

export type AttentionItem = {
  id: string;
  severity: AttentionSeverity;
  title: string;
  detail: string;
  href: string;
};

const FAILURE_STREAK_THRESHOLD = 2;

export function deriveAttention(
  agents: AgentRecord[],
  agentRuns: AgentRunRecord[],
  projects: WorkProjectRecord[],
  tasks: WorkTaskRecord[],
  opportunities: OpportunityRecord[],
): AttentionItem[] {
  const agentById = new Map(agents.map((a) => [a.agentId, a]));
  const items: AttentionItem[] = [];

  for (const run of agentRuns) {
    if (!run.agentId || run.failures.length < FAILURE_STREAK_THRESHOLD) continue;
    const agent = agentById.get(run.agentId);
    const label = agent?.name ?? run.agentId;
    const lastFailure = run.failures[run.failures.length - 1];
    items.push({
      id: `critical:${run.workPackageId}`,
      severity: 'critical',
      title: `${label} failed ${run.failures.length} times`,
      detail: lastFailure?.message ?? 'Repeated failures in the current run.',
      href: `/company/agents/${run.agentId}`,
    });
  }

  for (const opp of opportunities) {
    if ((opp.score?.overall ?? 0) < PROMISING_SCORE_THRESHOLD) continue;
    if (!DECIDABLE_OPPORTUNITY_STATUSES.has(opp.status)) continue;
    items.push({
      id: `decision:${opp.id}`,
      severity: 'decision',
      title: opp.title,
      detail: `Score ${opp.score!.overall}/100 — CEO decision required.`,
      href: `/company/opportunities/${opp.id}`,
    });
  }

  const projectById = new Map(projects.map((p) => [p.projectId, p]));
  for (const task of tasks) {
    if (task.status !== 'Blocked') continue;
    const project = projectById.get(task.projectId);
    items.push({
      id: `blocked:${task.taskId}`,
      severity: 'blocked',
      title: project ? project.name : task.projectId,
      detail: task.assignedAgentId
        ? `Task "${task.title}" is blocked.`
        : `Task "${task.title}" is blocked and unassigned.`,
      href: project ? `/company/projects/${project.projectId}` : '/company/tasks',
    });
  }

  const severityOrder: Record<AttentionSeverity, number> = { critical: 0, decision: 1, blocked: 2 };
  return items.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

// --- Company Activity Timeline ----------------------------------------------

export type AuditRecordWithDetail = AuditRecordLike & { detail?: Record<string, unknown> };

export type ActivityEntry = {
  id: string;
  at: string;
  icon: string;
  headline: string;
  technical: {
    action: string;
    actor: string;
    resourceType: string;
    resourceId: string;
    outcome: string;
    correlationId?: string;
    detail?: Record<string, unknown>;
  };
};

function payloadString(detail: Record<string, unknown> | undefined, key: string): string | undefined {
  const payload = detail?.payload;
  if (payload && typeof payload === 'object' && key in payload) {
    const value = (payload as Record<string, unknown>)[key];
    return typeof value === 'string' ? value : undefined;
  }
  return undefined;
}

function ceoCommandHeadline(
  record: AuditRecordWithDetail,
  lookups: {
    opportunities: Map<string, OpportunityRecord>;
    projects: Map<string, WorkProjectRecord>;
    tasks: Map<string, WorkTaskRecord>;
    agents: Map<string, AgentRecord>;
  },
): { icon: string; headline: string } | null {
  const actor = record.actor;
  switch (record.action) {
    case 'SelectOpportunity': {
      const id = payloadString(record.detail, 'opportunityId');
      const opp = id ? lookups.opportunities.get(id) : undefined;
      return { icon: '🧠', headline: `CEO selected "${opp?.title ?? id ?? 'an opportunity'}"` };
    }
    case 'RejectOpportunity': {
      const id = payloadString(record.detail, 'opportunityId');
      const opp = id ? lookups.opportunities.get(id) : undefined;
      const reason = payloadString(record.detail, 'reason');
      return {
        icon: '✕',
        headline: `CEO rejected "${opp?.title ?? id ?? 'an opportunity'}"${reason ? ` — ${reason}` : ''}`,
      };
    }
    case 'CreateProject': {
      const name = payloadString(record.detail, 'name');
      return { icon: '◆', headline: `Project "${name ?? record.resourceId}" created` };
    }
    case 'CreateProjectFromOpportunity': {
      const oppId = payloadString(record.detail, 'opportunityId');
      const opp = oppId ? lookups.opportunities.get(oppId) : undefined;
      return { icon: '◆', headline: `Project created from "${opp?.title ?? oppId ?? 'opportunity'}"` };
    }
    case 'PauseProject': {
      const project = lookups.projects.get(record.resourceId);
      return { icon: '⏸', headline: `Project "${project?.name ?? record.resourceId}" paused by ${actor}` };
    }
    case 'ResumeProject': {
      const project = lookups.projects.get(record.resourceId);
      return { icon: '▶', headline: `Project "${project?.name ?? record.resourceId}" resumed` };
    }
    case 'CancelProject': {
      const project = lookups.projects.get(record.resourceId);
      return { icon: '✕', headline: `Project "${project?.name ?? record.resourceId}" cancelled` };
    }
    case 'CreateTask': {
      const title = payloadString(record.detail, 'title');
      return { icon: '◆', headline: `Task "${title ?? record.resourceId}" created` };
    }
    case 'AssignTask':
    case 'ReassignTask': {
      const task = lookups.tasks.get(record.resourceId);
      const agentId = payloadString(record.detail, 'agentId');
      const agent = agentId ? lookups.agents.get(agentId) : undefined;
      return {
        icon: '⚙',
        headline: `"${task?.title ?? record.resourceId}" assigned to ${agent?.name ?? agentId ?? 'an agent'}`,
      };
    }
    case 'PauseAgent': {
      const agent = lookups.agents.get(record.resourceId);
      return { icon: '⏸', headline: `${agent?.name ?? record.resourceId} paused by CEO` };
    }
    case 'ResumeAgent': {
      const agent = lookups.agents.get(record.resourceId);
      return { icon: '▶', headline: `${agent?.name ?? record.resourceId} resumed by CEO` };
    }
    case 'CancelWork': {
      const agent = lookups.agents.get(record.resourceId);
      return { icon: '✕', headline: `Work cancelled for ${agent?.name ?? record.resourceId}` };
    }
    default:
      return null;
  }
}

export function deriveActivityFeed(
  auditRecords: AuditRecordWithDetail[],
  opportunities: OpportunityRecord[],
  projects: WorkProjectRecord[],
  tasks: WorkTaskRecord[],
  agents: AgentRecord[],
): ActivityEntry[] {
  const lookups = {
    opportunities: new Map(opportunities.map((o) => [o.id, o])),
    projects: new Map(projects.map((p) => [p.projectId, p])),
    tasks: new Map(tasks.map((t) => [t.taskId, t])),
    agents: new Map(agents.map((a) => [a.agentId, a])),
  };

  const entries: ActivityEntry[] = [];
  for (const record of auditRecords) {
    if (isDemoAuditRecord(record)) continue;

    const command = ceoCommandHeadline(record, lookups);
    const headline = command ?? (() => {
      const story = describeAuditRecord(record);
      return { icon: story.title.toLowerCase().includes('approval') ? '⏳' : '✓', headline: story.what };
    })();

    entries.push({
      id: `${record.action}:${record.resourceId}:${record.occurredAt}`,
      at: record.occurredAt,
      icon: headline.icon,
      headline: record.outcome !== 'success' ? `${headline.headline} (failed)` : headline.headline,
      technical: {
        action: record.action,
        actor: record.actor,
        resourceType: record.resourceType,
        resourceId: record.resourceId,
        outcome: record.outcome,
        correlationId: record.correlationId,
        detail: record.detail,
      },
    });
  }

  return entries.sort((a, b) => (a.at < b.at ? 1 : -1));
}

// --- While You Were Away -----------------------------------------------------

export type WhileYouWereAway = {
  agentRunsCompleted: number;
  opportunitiesSelected: number;
  projectsCreated: number;
  agentFailures: number;
  decisionsMade: number;
  narrative: string;
};

const CEO_COMMAND_ACTIONS = new Set([
  'SelectOpportunity',
  'RejectOpportunity',
  'CreateProject',
  'CreateProjectFromOpportunity',
  'PauseProject',
  'ResumeProject',
  'CancelProject',
  'CreateTask',
  'AssignTask',
  'ReassignTask',
  'PauseAgent',
  'ResumeAgent',
  'CancelWork',
]);

export function deriveWhileYouWereAway(
  auditRecords: AuditRecordWithDetail[],
  agentRuns: AgentRunRecord[],
  sinceIso: string,
): WhileYouWereAway {
  const recentAudit = auditRecords.filter((r) => !isDemoAuditRecord(r) && r.occurredAt > sinceIso);
  const recentRuns = agentRuns.filter((r) => r.finishedAt && r.finishedAt > sinceIso);

  const result: WhileYouWereAway = {
    agentRunsCompleted: recentRuns.filter((r) => r.status === 'completed').length,
    opportunitiesSelected: recentAudit.filter((r) => r.action === 'SelectOpportunity' && r.outcome === 'success').length,
    projectsCreated: recentAudit.filter(
      (r) => (r.action === 'CreateProject' || r.action === 'CreateProjectFromOpportunity') && r.outcome === 'success',
    ).length,
    agentFailures: recentRuns.filter((r) => r.status === 'failed').length,
    decisionsMade: recentAudit.filter((r) => CEO_COMMAND_ACTIONS.has(r.action) && r.outcome === 'success').length,
    narrative: '',
  };

  const bits: string[] = [];
  if (result.agentRunsCompleted > 0) bits.push(`${plural(result.agentRunsCompleted, 'run')} completed`);
  if (result.decisionsMade > 0) bits.push(`${plural(result.decisionsMade, 'decision')} made`);
  if (result.agentFailures > 0) bits.push(`${plural(result.agentFailures, 'failure')} to review`);

  result.narrative =
    bits.length === 0
      ? 'Nothing happened while you were away.'
      : result.agentFailures > 0
        ? `Company activity continued. ${bits.join(', ')} — one thing needs your attention.`
        : `Company activity continued normally. ${bits.join(', ')}.`;

  return result;
}
