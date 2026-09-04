/**
 * Presentation-layer derivations for the CEO Control Center. Every function
 * here is a pure reducer over real read-model data already fetched from
 * control-api (@see control-api.ts) — nothing here invents entities, counts,
 * or reasoning. Where a signal genuinely doesn't exist yet (e.g. a stored
 * decision confidence score, or a task dependency chain), the caller simply
 * omits it rather than this module fabricating one.
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

function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  return remMinutes > 0 ? `${hours}h ${remMinutes}m` : `${hours}h`;
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
const HIGH_PRIORITY_SCORE_THRESHOLD = 85;
const DECIDABLE_OPPORTUNITY_STATUSES = new Set(['researching', 'validated', 'outreach_ready', 'in_sales']);
const ACTIVE_TASK_STATUSES = new Set(['Ready', 'Assigned', 'InProgress', 'InReview']);
const OPEN_TASK_STATUSES = new Set(['Ready', 'Assigned', 'InProgress', 'InReview']);

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

// --- CEO Attention — explainable cases ---------------------------------------
//
// Every case here is backed by a real, currently-reachable signal:
//   - repeated_failure: an agent run's own `failures[]` (Runtime Observability)
//   - decision_required: opportunities sitting in a decidable status with a
//     real score (Opportunity Intelligence) — aggregated into ONE case so a
//     pipeline of 50 viable opportunities reads as "one decision queue," not
//     50 separate alerts (this was the actual bug behind the old raw count)
//   - waiting_too_long: real `startedAt`/`updatedAt` timestamps aging past a
//     threshold
//
// Deliberately NOT modeled: a "blocked on a missing artifact/dependency"
// case. Investigation confirmed `TaskStatus: 'Blocked'` and
// `DependencyContractSchema` are schema-only — no command handler in this
// codebase ever sets a task Blocked or records what it depends on. Building
// that case would mean fabricating the dependency chain, which the product
// brief explicitly forbids. Revisit once that backend state is real.

export type AttentionSeverity = 'critical' | 'high' | 'medium' | 'low';
export type AttentionCategory = 'repeated_failure' | 'decision_required' | 'waiting_too_long';

export type AttentionSourceLink = {
  label: string;
  type: 'opportunity' | 'project' | 'task' | 'agent' | 'run';
  id: string;
  href: string;
};

export type AttentionCase = {
  id: string;
  category: AttentionCategory;
  severity: AttentionSeverity;
  /** Why this severity was assigned — always a real, computed reason, never an unexplained score. */
  severityReason: string;
  title: string;
  whatHappened: string;
  source: AttentionSourceLink[];
  evidence: string[];
  currentState: Array<{ label: string; value: string }>;
  recommendedNextAction: string;
  ceoActionNeeded: boolean;
  occurredAt: string;
  technical: Record<string, unknown>;
};

const FAILURE_STREAK_THRESHOLD = 2;
const STALE_RUN_MS = 30 * 60 * 1000; // 30 minutes
const STALE_TASK_MS = 4 * 60 * 60 * 1000; // 4 hours

function agentLabel(agent: AgentRecord | undefined, fallback: string): string {
  return agent?.name ?? fallback;
}

function taskSourceLink(task: WorkTaskRecord, projects: WorkProjectRecord[]): AttentionSourceLink | undefined {
  const project = projects.find((p) => p.projectId === task.projectId);
  return project
    ? { label: project.name, type: 'project', id: project.projectId, href: `/company/projects/${project.projectId}` }
    : undefined;
}

export function deriveAttentionCases(
  agents: AgentRecord[],
  agentRuns: AgentRunRecord[],
  projects: WorkProjectRecord[],
  tasks: WorkTaskRecord[],
  opportunities: OpportunityRecord[],
  now: number = Date.now(),
): AttentionCase[] {
  const agentById = new Map(agents.map((a) => [a.agentId, a]));
  const cases: AttentionCase[] = [];

  // --- repeated_failure ------------------------------------------------------
  for (const run of agentRuns) {
    if (!run.agentId || run.failures.length < FAILURE_STREAK_THRESHOLD) continue;
    const agent = agentById.get(run.agentId);
    const label = agentLabel(agent, run.agentId);
    const lastFailure = run.failures[run.failures.length - 1]!;
    const activeAgentTasks = tasks.filter(
      (t) => t.assignedAgentId === run.agentId && OPEN_TASK_STATUSES.has(t.status),
    );
    const source: AttentionSourceLink[] = [
      { label, type: 'agent', id: run.agentId, href: `/company/agents/${run.agentId}` },
    ];
    const relatedProject = activeAgentTasks.length > 0 ? taskSourceLink(activeAgentTasks[0]!, projects) : undefined;
    if (relatedProject) source.unshift(relatedProject);

    cases.push({
      id: `repeated-failure:${run.workPackageId}`,
      category: 'repeated_failure',
      severity: 'critical',
      severityReason:
        activeAgentTasks.length > 0
          ? `Blocks ${plural(activeAgentTasks.length, 'active task')} assigned to ${label}.`
          : `${label} cannot make progress on its current run.`,
      title: `${label} failed ${run.failures.length} times`,
      whatHappened: `${label}'s run ${run.workPackageId} has failed ${run.failures.length} times. Latest: ${lastFailure.message}`,
      source,
      evidence: run.failures.map((f) => `${f.source} failure at ${f.at}: ${f.message}`),
      currentState: [
        { label: 'Agent', value: agent?.controlState === 'paused' ? 'paused' : agent?.status ?? 'unknown' },
        { label: 'Run', value: run.status },
      ],
      recommendedNextAction:
        'Investigate the run — repeated failures usually mean a bad tool input or an unrecoverable error, not a transient one.',
      ceoActionNeeded: true,
      occurredAt: lastFailure.at,
      technical: {
        workPackageId: run.workPackageId,
        correlationId: run.correlationId,
        runId: run.runId,
        failures: run.failures,
      },
    });
  }

  // --- decision_required (aggregated) ----------------------------------------
  const decidable = opportunities.filter(
    (o) => (o.score?.overall ?? 0) >= PROMISING_SCORE_THRESHOLD && DECIDABLE_OPPORTUNITY_STATUSES.has(o.status),
  );
  if (decidable.length > 0) {
    const sorted = [...decidable].sort((a, b) => (b.score!.overall ?? 0) - (a.score!.overall ?? 0));
    const top = sorted.slice(0, 5);
    const highPriorityCount = decidable.filter((o) => (o.score?.overall ?? 0) >= HIGH_PRIORITY_SCORE_THRESHOLD).length;
    const mostRecent = [...decidable].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0]!;

    cases.push({
      id: 'decision-required:opportunities',
      category: 'decision_required',
      severity: highPriorityCount > 0 ? 'high' : 'medium',
      severityReason:
        highPriorityCount > 0
          ? `${plural(highPriorityCount, 'opportunity', 'opportunities')} scored ${HIGH_PRIORITY_SCORE_THRESHOLD}+ and ${highPriorityCount === 1 ? 'is' : 'are'} ready to act on.`
          : `${plural(decidable.length, 'opportunity', 'opportunities')} ready for a decision.`,
      title: `${plural(decidable.length, 'opportunity', 'opportunities')} awaiting your decision`,
      whatHappened: `${decidable.length} ${decidable.length === 1 ? 'opportunity has' : 'opportunities have'} cleared research and ${decidable.length === 1 ? 'is' : 'are'} ready to select or reject.`,
      source: top.map((o) => ({
        label: o.title,
        type: 'opportunity' as const,
        id: o.id,
        href: `/company/opportunities/${o.id}`,
      })),
      evidence: top.map((o) => `"${o.title}" — score ${o.score!.overall}/100 (${o.status})`),
      currentState: [{ label: 'Queue', value: plural(decidable.length, 'opportunity', 'opportunities') }],
      recommendedNextAction: 'Review and select or reject the highest-scoring opportunities in Decisions.',
      ceoActionNeeded: true,
      occurredAt: mostRecent.updatedAt,
      technical: { opportunityIds: decidable.map((o) => o.id) },
    });
  }

  // --- waiting_too_long --------------------------------------------------------
  for (const run of agentRuns) {
    if (run.status !== 'running') continue;
    const ageMs = now - new Date(run.startedAt).getTime();
    if (!(ageMs > STALE_RUN_MS)) continue;
    const agent = run.agentId ? agentById.get(run.agentId) : undefined;
    const label = agentLabel(agent, run.agentId ?? run.workPackageId);
    cases.push({
      id: `waiting-too-long:run:${run.workPackageId}`,
      category: 'waiting_too_long',
      severity: ageMs > STALE_RUN_MS * 2 ? 'high' : 'medium',
      severityReason: `Running for ${formatDuration(ageMs)} without completing or failing.`,
      title: `${label} has been running for ${formatDuration(ageMs)}`,
      whatHappened: `${label}'s run ${run.workPackageId} started ${formatDuration(ageMs)} ago and hasn't finished.`,
      source: run.agentId
        ? [{ label, type: 'agent', id: run.agentId, href: `/company/agents/${run.agentId}` }]
        : [],
      evidence: [
        `Started at ${run.startedAt}`,
        `Current action: ${run.currentAction}${run.currentTool ? ` (${run.currentTool})` : ''}`,
      ],
      currentState: [
        { label: 'Status', value: run.status },
        { label: 'Current action', value: run.currentAction },
      ],
      recommendedNextAction: 'Check whether the agent is stuck; cancel the work if it does not recover.',
      ceoActionNeeded: false,
      occurredAt: run.updatedAt,
      technical: { workPackageId: run.workPackageId, correlationId: run.correlationId, startedAt: run.startedAt },
    });
  }

  for (const task of tasks) {
    if (!OPEN_TASK_STATUSES.has(task.status) || task.status === 'Ready') continue;
    const ageMs = now - new Date(task.updatedAt).getTime();
    if (!(ageMs > STALE_TASK_MS)) continue;
    const project = projects.find((p) => p.projectId === task.projectId);
    const agent = task.assignedAgentId ? agentById.get(task.assignedAgentId) : undefined;
    cases.push({
      id: `waiting-too-long:task:${task.taskId}`,
      category: 'waiting_too_long',
      severity: ageMs > STALE_TASK_MS * 2 ? 'high' : 'medium',
      severityReason: `Hasn't changed status in ${formatDuration(ageMs)}.`,
      title: `"${task.title}" has been ${task.status.toLowerCase()} for ${formatDuration(ageMs)}`,
      whatHappened: `Task "${task.title}" has stayed in ${task.status} for ${formatDuration(ageMs)} with no recorded status change.`,
      source: project
        ? [{ label: project.name, type: 'project', id: project.projectId, href: `/company/projects/${project.projectId}` }]
        : [],
      evidence: [`Last updated at ${task.updatedAt}`, `Assigned to: ${agent?.name ?? task.assignedAgentId ?? 'unassigned'}`],
      currentState: [{ label: 'Status', value: task.status }],
      recommendedNextAction: 'Check in with the assigned agent or reassign the task.',
      ceoActionNeeded: false,
      occurredAt: task.updatedAt,
      technical: { taskId: task.taskId, projectId: task.projectId },
    });
  }

  const severityOrder: Record<AttentionSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return cases.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

export const deriveAttention = deriveAttentionCases;
export type AttentionItem = AttentionCase;

export function deriveCompanySummary(pulse: CompanyPulse, attentionCount: number): string {
  if (attentionCount > 0) {
    return `${pulse.agents.working} agents operating across ${pulse.projects.active} projects. ${attentionCount} attention ${attentionCount === 1 ? 'case requires' : 'cases require'} CEO review.`;
  }
  return `${pulse.agents.working} agents operating across ${pulse.projects.active} active projects with operations running smoothly.`;
}

// --- Company Story -----------------------------------------------------------

export function deriveCompanyStory(
  pulse: CompanyPulse,
  attentionCases: AttentionCase[],
  projects: WorkProjectRecord[],
  tasks: WorkTaskRecord[],
  agents: AgentRecord[],
): string {
  const sentences: string[] = [];

  if (pulse.opportunities.promising > 0) {
    sentences.push(
      `The company is currently validating ${plural(pulse.opportunities.promising, 'high-potential opportunity', 'high-potential opportunities')}.`,
    );
  } else {
    sentences.push('The company has no high-potential opportunities queued right now.');
  }

  const activeProjects = projects.filter((p) => p.status === 'Active');
  if (activeProjects.length > 0) {
    const byTaskCount = activeProjects
      .map((p) => ({ project: p, taskCount: tasks.filter((t) => t.projectId === p.projectId).length }))
      .sort((a, b) => b.taskCount - a.taskCount);
    const top = byTaskCount[0]!.project;
    const workingOnTop = agents.filter(
      (a) =>
        (a.currentProjectId === top.projectId || tasks.some((t) => t.projectId === top.projectId && t.assignedAgentId === a.agentId)) &&
        a.status === 'active',
    ).length;
    sentences.push(
      `"${top.name}" is the highest-priority project${workingOnTop > 0 ? `, with ${plural(workingOnTop, 'agent')} actively working on it` : ''}.`,
    );
  }

  const critical = attentionCases.filter((c) => c.severity === 'critical').length;
  if (critical > 0) {
    sentences.push(`${plural(critical, 'critical issue')} ${critical === 1 ? 'needs' : 'need'} your attention.`);
  } else if (attentionCases.length > 0) {
    sentences.push(
      `No critical company-wide issues detected — ${plural(attentionCases.length, 'lower-priority item')} worth a look when you have time.`,
    );
  } else {
    sentences.push('No issues detected — operations are running normally.');
  }

  return sentences.join(' ');
}

// --- Company Activity Timeline (CEO command audit trail) -------------------

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

// --- Live Company Activity (agent-run operational play-by-play) -------------
//
// Sourced from AgentRunSnapshot.actionLog — real, structural sentences
// already produced by the Runtime Observability reducer ("Requested tool
// 'search_web'", "Tool 'search_web' completed in 340ms", "Run completed
// (artifact art-123)"). Never a fabricated first-person quote.

export type LiveActivityEntry = {
  id: string;
  at: string;
  agentLabel: string;
  summary: string;
};

export function deriveLiveActivity(agentRuns: AgentRunRecord[], agents: AgentRecord[], limit = 15): LiveActivityEntry[] {
  const agentById = new Map(agents.map((a) => [a.agentId, a]));
  const entries: LiveActivityEntry[] = [];
  for (const run of agentRuns) {
    const agent = run.agentId ? agentById.get(run.agentId) : undefined;
    const label = agentLabel(agent, run.specialistId ?? run.agentId ?? run.workPackageId);
    run.actionLog.forEach((log, idx) => {
      entries.push({ id: `${run.workPackageId}:${idx}`, at: log.at, agentLabel: label, summary: log.summary });
    });
  }
  return entries.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, limit);
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
