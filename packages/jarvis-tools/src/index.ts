import type { JarvisTool } from '@umer/jarvis-core';
import { createJarvisMemory, type JarvisMemory, type MemoryAccessPrincipal } from '@umer/jarvis-memory';
import { gatherEvidence } from './evidence.js';
import { buildCeoReasoning } from './reasoning.js';
import { buildProjectSummary } from './project-summary.js';

export { authorizeJarvisTool, createAuthorizedJarvisTools, type AuthorizedJarvisToolsOptions } from './authorization.js';
export * from './evidence.js';
export * from './reasoning.js';
export * from './project-summary.js';

export type JarvisControlToolsOptions = {
  controlApiBaseUrl?: string;
  fetchImpl?: typeof fetch;
  memory?: JarvisMemory;
};

function objectInput(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  return input as Record<string, unknown>;
}

/**
 * Full agent-run records carry unbounded toolCalls/decisions/actionLog history
 * (real runs have measured in the hundreds of KB each) that blows past small
 * local-model context windows when embedded raw into a tool result. Attention
 * and briefing tools only need enough to name and explain the failure.
 */
function summarizeFailedRun(run: unknown): Record<string, unknown> {
  const r = objectInput(run);
  const actionLog = Array.isArray(r.actionLog) ? r.actionLog : [];
  const lastAction = actionLog.length > 0 ? actionLog[actionLog.length - 1] : undefined;
  return {
    workPackageId: r.workPackageId,
    runId: r.runId,
    specialistId: r.specialistId,
    agentId: r.agentId,
    status: r.status,
    errorMessage: r.errorMessage,
    finishedAt: r.finishedAt,
    lastAction,
  };
}

async function requestJson(baseUrl: string, path: string, init: RequestInit | undefined, fetchImpl: typeof fetch): Promise<unknown> {
  const response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}${path}`, {
    ...init,
    headers: { accept: 'application/json', ...(init?.headers ?? {}) },
  });
  const text = await response.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }
  if (!response.ok) throw new Error(`Control API returned HTTP ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

function isoTime(value: unknown): number {
  if (typeof value !== 'string') return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function withinWindow(record: unknown, since: number): boolean {
  const r = objectInput(record);
  const timestamp = r.occurredAt ?? r.createdAt ?? r.updatedAt ?? r.timestamp ?? r.startedAt ?? r.completedAt ?? r.failedAt;
  const time = isoTime(timestamp);
  return time === 0 || time >= since;
}

export function createJarvisControlTools(options: JarvisControlToolsOptions = {}): JarvisTool[] {
  const baseUrl = options.controlApiBaseUrl ?? process.env.CONTROL_API_BASE_URL ?? 'http://127.0.0.1:4000';
  const fetchImpl = options.fetchImpl ?? fetch;
  const memory = options.memory ?? createJarvisMemory();

  const systemSnapshot: JarvisTool = {
    name: 'control_plane_snapshot',
    description: 'Read the authoritative Umer AI OS control-plane dashboard: agents, active runs, work packages, pending gates, opportunities, artifacts and CEO attention. Use this for questions about current system activity.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    execute: async () => requestJson(baseUrl, '/v1/dashboard', { method: 'GET' }, fetchImpl),
  };

  const ceoBriefing: JarvisTool = {
    name: 'ceo_briefing',
    description: 'Build a current CEO briefing from authoritative control-plane read models. Use for morning briefings, catch-up, what changed, what needs attention, workforce status, blockers, active work, and business pipeline. Do not infer missing fields.',
    parameters: { type: 'object', properties: { opportunityLimit: { type: 'integer', minimum: 1, maximum: 20 } }, additionalProperties: false },
    execute: async (input) => {
      const body = objectInput(input);
      const n = Number(body.opportunityLimit ?? 10);
      const limit = Number.isInteger(n) && n >= 1 && n <= 20 ? n : 10;
      const [dashboard, agents, opportunities, failedRuns, audit] = await Promise.all([
        requestJson(baseUrl, '/v1/dashboard', { method: 'GET' }, fetchImpl),
        requestJson(baseUrl, '/v1/agents', { method: 'GET' }, fetchImpl),
        requestJson(baseUrl, `/v1/opportunities?limit=${limit}`, { method: 'GET' }, fetchImpl),
        requestJson(baseUrl, '/v1/agent-runs?status=failed', { method: 'GET' }, fetchImpl),
        requestJson(baseUrl, '/v1/audit/recent', { method: 'GET' }, fetchImpl),
      ]);
      const failed = objectInput(failedRuns);
      const runs = Array.isArray(failed.agentRuns) ? failed.agentRuns : [];
      return {
        generatedAt: new Date().toISOString(),
        source: 'control-api-read-models',
        dashboard,
        agents,
        opportunities,
        failedRuns: { count: runs.length, runs: runs.slice(0, 20).map(summarizeFailedRun) },
        audit,
      };
    },
  };

  const ceoAttention: JarvisTool = {
    name: 'ceo_attention',
    description: 'Evaluate what currently deserves CEO attention using authoritative dashboard, failed agent runs, pending gates and recent audit evidence. Return evidence and severity; never invent incidents or activity.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    execute: async () => {
      const [dashboard, failedRuns, audit] = await Promise.all([
        requestJson(baseUrl, '/v1/dashboard', { method: 'GET' }, fetchImpl),
        requestJson(baseUrl, '/v1/agent-runs?status=failed', { method: 'GET' }, fetchImpl),
        requestJson(baseUrl, '/v1/audit/recent', { method: 'GET' }, fetchImpl),
      ]);
      const d = objectInput(dashboard);
      const failed = objectInput(failedRuns);
      const findings = Array.isArray(d.watchdogFindings) ? d.watchdogFindings : [];
      const gates = Array.isArray(d.pendingGates) ? d.pendingGates : [];
      const runs = Array.isArray(failed.agentRuns) ? failed.agentRuns : [];
      const records = Array.isArray(objectInput(audit).records) ? objectInput(audit).records as unknown[] : [];
      const attention: Array<Record<string, unknown>> = [];
      for (const finding of findings) attention.push({ severity: 'high', source: 'watchdog', evidence: finding });
      for (const gate of gates) attention.push({ severity: 'high', source: 'pending_gate', evidence: gate, recommendedNextStep: 'Review the gate and explicitly Pass or Fail it.' });
      for (const run of runs.slice(0, 20)) attention.push({ severity: 'high', source: 'failed_agent_run', evidence: summarizeFailedRun(run), recommendedNextStep: 'Inspect the failed run and its error evidence before retrying or delegating new work.' });
      return { generatedAt: new Date().toISOString(), source: 'control-api-read-models', attention, counts: { watchdogFindings: findings.length, pendingGates: gates.length, failedRuns: runs.length }, recentAudit: records.slice(-20), dashboard };
    },
  };

  const attentionFeed: JarvisTool = {
    name: 'attention_feed',
    description: 'Read the current CEO attention feed from the dedicated control-plane attention evaluator. Use for urgent items and proactive status checks. This is read-only and never performs the recommended action.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    execute: async () => requestJson(baseUrl, '/v1/ceo/attention', { method: 'GET' }, fetchImpl),
  };

  const listAgents: JarvisTool = {
    name: 'list_agents',
    description: 'Read the currently registered AI workforce and their current project/task state from the control plane.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    execute: async () => requestJson(baseUrl, '/v1/agents', { method: 'GET' }, fetchImpl),
  };

  const inspectAgentRuns: JarvisTool = {
    name: 'inspect_agent_runs',
    description: 'Inspect authoritative agent-run observability. Use to explain which work packages are running, completed, or failed. Optionally filter by status.',
    parameters: { type: 'object', properties: { status: { type: 'string', enum: ['running', 'completed', 'failed'] } }, additionalProperties: false },
    execute: async (input) => {
      const body = objectInput(input);
      const status = typeof body.status === 'string' && ['running', 'completed', 'failed'].includes(body.status) ? body.status : undefined;
      return requestJson(baseUrl, `/v1/agent-runs${status ? `?status=${encodeURIComponent(status)}` : ''}`, { method: 'GET' }, fetchImpl);
    },
  };

  const inspectAgentRun: JarvisTool = {
    name: 'inspect_agent_run',
    description: 'Inspect one authoritative agent run using its Work Package ID. Use when the CEO asks why a specific run failed or what happened to a specific work package.',
    parameters: { type: 'object', properties: { workPackageId: { type: 'string' } }, required: ['workPackageId'], additionalProperties: false },
    execute: async (input) => {
      const body = objectInput(input);
      if (typeof body.workPackageId !== 'string' || !body.workPackageId.trim()) throw new Error('workPackageId is required');
      return requestJson(baseUrl, `/v1/agent-runs/${encodeURIComponent(body.workPackageId.trim())}`, { method: 'GET' }, fetchImpl);
    },
  };

  const listWorkPackages: JarvisTool = {
    name: 'list_work_packages',
    description: 'Read current Work Package records from the control-plane dashboard. Use to identify specialist, project, stage, status, artifact and error information when available.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    execute: async () => {
      const dashboard = await requestJson(baseUrl, '/v1/dashboard', { method: 'GET' }, fetchImpl) as Record<string, unknown>;
      return { workPackages: dashboard.workPackages ?? [], pendingGates: dashboard.pendingGates ?? [], source: 'control-api-dashboard' };
    },
  };

  const listTasks: JarvisTool = {
    name: 'list_tasks',
    description: 'Read task assignments and status from the Work Management read model. Optional filters: agent, project, status.',
    parameters: { type: 'object', properties: { agent: { type: 'string' }, project: { type: 'string' }, status: { type: 'string' } }, additionalProperties: false },
    execute: async (input) => {
      const body = objectInput(input);
      const params = new URLSearchParams();
      for (const key of ['agent', 'project', 'status']) if (typeof body[key] === 'string' && body[key].trim()) params.set(key, body[key].trim());
      return requestJson(baseUrl, `/v1/tasks${params.toString() ? `?${params}` : ''}`, { method: 'GET' }, fetchImpl);
    },
  };

  const listOpportunities: JarvisTool = {
    name: 'list_opportunities',
    description: 'Read current business opportunities from the Umer AI OS opportunity read model. Use when the CEO asks about opportunities or revenue pipeline.',
    parameters: { type: 'object', properties: { limit: { type: 'integer', minimum: 1, maximum: 50 } }, additionalProperties: false },
    execute: async (input) => {
      const { limit = 20 } = objectInput(input); const n = Number(limit);
      const suffix = Number.isInteger(n) && n >= 1 && n <= 50 ? `?limit=${n}` : '?limit=20';
      return requestJson(baseUrl, `/v1/opportunities${suffix}`, { method: 'GET' }, fetchImpl);
    },
  };

  const listAudit: JarvisTool = {
    name: 'inspect_audit_trail',
    description: 'Read the append-only audit trail. Use for what changed, who acted, correlation tracing and explaining lifecycle events. Audit is evidence, not a substitute for current read models.',
    parameters: { type: 'object', properties: { correlationId: { type: 'string' }, actor: { type: 'string' }, action: { type: 'string' } }, additionalProperties: false },
    execute: async (input) => {
      const body = objectInput(input);
      const params = new URLSearchParams();
      for (const key of ['correlationId', 'actor', 'action']) if (typeof body[key] === 'string' && body[key].trim()) params.set(key, body[key].trim());
      const result = await requestJson(baseUrl, `/v1/audit/recent${params.toString() ? `?${params}` : ''}`, { method: 'GET' }, fetchImpl) as Record<string, unknown>;
      if (!params.toString()) return result;
      const records = Array.isArray(result.records) ? result.records : [];
      return { records: records.filter((record) => { const r = objectInput(record); return (!body.correlationId || r.correlationId === body.correlationId) && (!body.actor || r.actor === body.actor) && (!body.action || r.action === body.action); }) };
    },
  };

  const companyTimeline: JarvisTool = {
    name: 'company_timeline',
    description: 'Reconstruct a recent company timeline from authoritative audit, run, task and opportunity read models. Use for "what happened while I was away?" and change-history questions. The timeline is evidence-based and does not invent missing events.',
    parameters: { type: 'object', properties: { hours: { type: 'integer', minimum: 1, maximum: 168 }, limit: { type: 'integer', minimum: 1, maximum: 100 } }, additionalProperties: false },
    execute: async (input) => {
      const body = objectInput(input);
      const hoursValue = Number(body.hours ?? 24);
      const limitValue = Number(body.limit ?? 50);
      const hours = Number.isInteger(hoursValue) && hoursValue >= 1 && hoursValue <= 168 ? hoursValue : 24;
      const limit = Number.isInteger(limitValue) && limitValue >= 1 && limitValue <= 100 ? limitValue : 50;
      const since = Date.now() - hours * 60 * 60 * 1000;
      const [audit, runs, tasks, opportunities] = await Promise.all([
        requestJson(baseUrl, '/v1/audit/recent', { method: 'GET' }, fetchImpl),
        requestJson(baseUrl, '/v1/agent-runs', { method: 'GET' }, fetchImpl),
        requestJson(baseUrl, '/v1/tasks', { method: 'GET' }, fetchImpl),
        requestJson(baseUrl, `/v1/opportunities?limit=50`, { method: 'GET' }, fetchImpl),
      ]);
      const events: Array<Record<string, unknown>> = [];
      const auditObj = objectInput(audit);
      const runsObj = objectInput(runs);
      const tasksObj = objectInput(tasks);
      const opportunitiesObj = objectInput(opportunities);
      const records = Array.isArray(auditObj.records) ? auditObj.records : [];
      for (const record of records) if (withinWindow(record, since)) events.push({ kind: 'audit', timestamp: objectInput(record).occurredAt ?? objectInput(record).createdAt ?? objectInput(record).timestamp, data: record });
      const runItems = Array.isArray(runsObj.agentRuns) ? runsObj.agentRuns : [];
      for (const run of runItems) if (withinWindow(run, since)) events.push({ kind: 'agent_run', timestamp: objectInput(run).updatedAt ?? objectInput(run).completedAt ?? objectInput(run).startedAt, data: run });
      const taskItems = Array.isArray(tasksObj.tasks) ? tasksObj.tasks : [];
      for (const task of taskItems) if (withinWindow(task, since)) events.push({ kind: 'task', timestamp: objectInput(task).updatedAt ?? objectInput(task).createdAt, data: task });
      const opportunityItems = Array.isArray(opportunitiesObj.opportunities) ? opportunitiesObj.opportunities : [];
      for (const opportunity of opportunityItems) if (withinWindow(opportunity, since)) events.push({ kind: 'opportunity', timestamp: objectInput(opportunity).updatedAt ?? objectInput(opportunity).createdAt, data: opportunity });
      events.sort((a, b) => isoTime(b.timestamp) - isoTime(a.timestamp));
      return { generatedAt: new Date().toISOString(), since: new Date(since).toISOString(), hours, count: Math.min(events.length, limit), timeline: events.slice(0, limit), sources: ['audit', 'agent-runs', 'tasks', 'opportunities'] };
    },
  };

  const awayBriefing: JarvisTool = {
    name: 'away_briefing',
    description: 'Prepare a CEO catch-up for a period while the user was away. Combines timeline evidence, current attention and workforce state. Use this instead of guessing what happened.',
    parameters: { type: 'object', properties: { hours: { type: 'integer', minimum: 1, maximum: 168 } }, additionalProperties: false },
    execute: async (input) => {
      const body = objectInput(input);
      const value = Number(body.hours ?? 24);
      const hours = Number.isInteger(value) && value >= 1 && value <= 168 ? value : 24;
      const [timeline, attention, dashboard] = await Promise.all([
        (companyTimeline.execute as (input: unknown) => Promise<unknown>)({ hours, limit: 50 }),
        requestJson(baseUrl, '/v1/ceo/attention', { method: 'GET' }, fetchImpl),
        requestJson(baseUrl, '/v1/dashboard', { method: 'GET' }, fetchImpl),
      ]);
      return { generatedAt: new Date().toISOString(), periodHours: hours, timeline, attention, currentState: dashboard };
    },
  };

  const listArtifacts: JarvisTool = {
    name: 'list_artifacts',
    description: 'Read artifacts known to the control API, optionally filtered by execution ID. Never imply an artifact exists unless the Artifact Runtime read model returns it.',
    parameters: { type: 'object', properties: { execId: { type: 'string' } }, additionalProperties: false },
    execute: async (input) => {
      const body = objectInput(input);
      const execId = typeof body.execId === 'string' && body.execId.trim() ? `?execId=${encodeURIComponent(body.execId.trim())}` : '';
      return requestJson(baseUrl, `/v1/artifacts${execId}`, { method: 'GET' }, fetchImpl);
    },
  };

  const inspectArtifact: JarvisTool = {
    name: 'inspect_artifact',
    description: 'Inspect one artifact by ID, including its authoritative contract and sealing metadata when available.',
    parameters: { type: 'object', properties: { artifactId: { type: 'string' } }, required: ['artifactId'], additionalProperties: false },
    execute: async (input) => {
      const body = objectInput(input);
      if (typeof body.artifactId !== 'string' || !body.artifactId.trim()) throw new Error('artifactId is required');
      return requestJson(baseUrl, `/v1/artifacts/${encodeURIComponent(body.artifactId.trim())}`, { method: 'GET' }, fetchImpl);
    },
  };

  const retrieveMemory: JarvisTool = {
    name: 'retrieve_memory',
    description: 'Retrieve relevant governed JARVIS memory. Use for prior decisions, lessons, research, patterns and working context. Treat returned citations as memory evidence, not current system state.',
    parameters: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'integer', minimum: 1, maximum: 10 }, memoryKinds: { type: 'array', items: { type: 'string', enum: ['Lesson', 'Pattern', 'BestPractice', 'Research', 'DecisionIntel', 'CaseStudy', 'WorkingNote'] } } }, required: ['query'], additionalProperties: false },
    execute: async (input, context) => {
      const body = objectInput(input);
      if (typeof body.query !== 'string' || !body.query.trim()) throw new Error('query is required');
      const memoryKinds = Array.isArray(body.memoryKinds) ? body.memoryKinds.filter((v): v is 'Lesson' | 'Pattern' | 'BestPractice' | 'Research' | 'DecisionIntel' | 'CaseStudy' | 'WorkingNote' => typeof v === 'string') : undefined;
      const principal: MemoryAccessPrincipal | undefined = context.principal ? { principalId: context.principal.principalId, grantedScopes: ['read'], tenantId: context.principal.tenantId } : undefined;
      return memory.retrieve(body.query.trim(), { limit: typeof body.limit === 'number' ? body.limit : undefined, memoryKinds, principal });
    },
  };

  const ceoIntelligence: JarvisTool = {
    name: 'ceo_intelligence',
    description: 'Build an evidence graph across agents, projects, tasks, Work Packages, runs, artifacts, audit events and opportunities. Use when the CEO asks what is connected, why something matters, why work failed, which specialist is working on a project, or what should happen next. Return only relationships supported by authoritative read models; distinguish observed facts from recommended next steps.',
    parameters: {
      type: 'object',
      properties: {
        focus: { type: 'string', description: 'Optional project, agent, task, work package, run, artifact, opportunity or keyword to focus the evidence graph.' },
        limit: { type: 'integer', minimum: 1, maximum: 100 },
      },
      additionalProperties: false,
    },
    execute: async (input) => {
      const body = objectInput(input);
      const focus = typeof body.focus === 'string' && body.focus.trim() ? body.focus.trim() : undefined;
      const rawLimit = Number(body.limit ?? 50);
      const limit = Number.isInteger(rawLimit) && rawLimit >= 1 && rawLimit <= 100 ? rawLimit : 50;
      const evidence = await gatherEvidence((path, init) => requestJson(baseUrl, path, init, fetchImpl), focus, limit);

      const failures = evidence.facts.filter((fact) => fact.type === 'agent_run' && ['failed', 'error'].includes(String(fact.status ?? '').toLowerCase()));
      const recommendations: Array<Record<string, unknown>> = [];
      for (const failure of failures.slice(0, 10)) recommendations.push({ priority: 'high', action: 'inspect_failed_run', reason: 'An authoritative agent run is marked failed.', evidenceId: failure.id, nextTool: 'inspect_agent_run' });
      for (const gate of evidence.pendingGates.slice(0, 10)) recommendations.push({ priority: 'high', action: 'review_pending_gate', reason: 'A human gate is still pending.', evidence: gate });

      return {
        generatedAt: new Date().toISOString(),
        source: 'control-api-read-models',
        focus: focus ?? null,
        counts: evidence.counts,
        evidenceGraph: evidence.facts.slice(0, limit),
        observedFailureCount: failures.length,
        pendingGateCount: evidence.pendingGates.length,
        recommendedNextSteps: recommendations,
        authority: 'authoritative read models; recommendations are derived and are not executed',
      };
    },
  };

  const delegateWork: JarvisTool = {
    name: 'delegate_work',
    description: 'Create a governed work intake through the existing Umer AI OS control plane. This does not bypass gates or execute irreversible work; it creates the normal intake/work-package flow for the appropriate specialist.',
    parameters: { type: 'object', properties: { projectId: { type: 'string' }, type: { type: 'string', enum: ['qa', 'seo', 'security', 'perf', 'ux', 'feature', 'bug'] }, goal: { type: 'string' }, doneWhen: { type: 'string' }, constraints: { type: 'array', items: { type: 'string' } } }, required: ['projectId', 'type', 'goal'], additionalProperties: false },
    execute: async (input) => {
      const body = objectInput(input);
      if (typeof body.projectId !== 'string' || typeof body.type !== 'string' || typeof body.goal !== 'string') throw new Error('projectId, type and goal are required');
      return requestJson(baseUrl, '/v1/intake', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId: body.projectId, type: body.type, goal: body.goal, doneWhen: typeof body.doneWhen === 'string' ? body.doneWhen : undefined, constraints: Array.isArray(body.constraints) ? body.constraints.filter((v): v is string => typeof v === 'string') : undefined }) }, fetchImpl);
    },
  };

  const baseTools: JarvisTool[] = [systemSnapshot, ceoBriefing, ceoAttention, attentionFeed, listAgents, inspectAgentRuns, inspectAgentRun, listWorkPackages, listTasks, listOpportunities, listAudit, companyTimeline, awayBriefing, listArtifacts, inspectArtifact, retrieveMemory, ceoIntelligence, delegateWork];
  const baseToolNames = new Set(baseTools.map((tool) => tool.name));

  const ceoRootCauseAnalysis: JarvisTool = {
    name: 'ceo_root_cause_analysis',
    description: 'Run the deterministic Evidence -> Causal Analysis -> Root Cause -> Business Impact -> Recommended Action -> Governed Delegation pipeline over authoritative read models. Use when the CEO asks "why did this fail", "what should we do about it", or "should we delegate a fix". Every statement is labeled OBSERVED_FACT, INFERENCE, or RECOMMENDATION. Never fabricates a root cause, confidence score, or business impact figure; if evidence is insufficient it explicitly says "Root cause not established" and names the missing evidence. Recommendations name governed tools but this tool never executes them.',
    parameters: {
      type: 'object',
      properties: {
        focus: { type: 'string', description: 'Project, agent, task, work package, run, artifact or opportunity keyword to scope the analysis.' },
        limit: { type: 'integer', minimum: 1, maximum: 100 },
        approvalGranted: { type: 'boolean', description: 'Set true only when the CEO/an authorized human has explicitly approved the specific delegation this analysis may recommend. Defaults to false (fails closed).' },
        doneWhen: { type: 'string', description: 'Acceptance criteria for a potential delegated fix. Required for governed delegation to be eligible.' },
        goal: { type: 'string', description: 'Goal text for a potential delegated fix, used only to describe WHAT would be delegated.' },
        delegationType: { type: 'string', enum: ['qa', 'seo', 'security', 'perf', 'ux', 'feature', 'bug'] },
      },
      additionalProperties: false,
    },
    execute: async (input, context) => {
      const body = objectInput(input);
      const focus = typeof body.focus === 'string' && body.focus.trim() ? body.focus.trim() : undefined;
      const rawLimit = Number(body.limit ?? 50);
      const limit = Number.isInteger(rawLimit) && rawLimit >= 1 && rawLimit <= 100 ? rawLimit : 50;
      const evidence = await gatherEvidence((path, init) => requestJson(baseUrl, path, init, fetchImpl), focus, limit);
      return buildCeoReasoning(evidence, {
        registeredToolNames: baseToolNames,
        authorize: context.authorize,
        approvalGranted: body.approvalGranted === true,
        doneWhen: typeof body.doneWhen === 'string' ? body.doneWhen : undefined,
        goal: typeof body.goal === 'string' ? body.goal : undefined,
        delegationType: typeof body.delegationType === 'string' ? body.delegationType : undefined,
      });
    },
  };

  const ceoProjectSummary: JarvisTool = {
    name: 'ceo_project_summary',
    description: 'Build a project-level CEO summary: current state, active agents, active tasks, active Work Packages, failed runs, pending gates, recent artifacts, blockers, opportunities, business impact and recommended next action — each populated only where matching evidence exists. Use when the CEO asks for a status update on a specific project.',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'The project to summarize.' },
        limit: { type: 'integer', minimum: 1, maximum: 100 },
      },
      required: ['projectId'],
      additionalProperties: false,
    },
    execute: async (input) => {
      const body = objectInput(input);
      if (typeof body.projectId !== 'string' || !body.projectId.trim()) throw new Error('projectId is required');
      const projectId = body.projectId.trim();
      const rawLimit = Number(body.limit ?? 100);
      const limit = Number.isInteger(rawLimit) && rawLimit >= 1 && rawLimit <= 100 ? rawLimit : 100;
      const evidence = await gatherEvidence((path, init) => requestJson(baseUrl, path, init, fetchImpl), undefined, limit);
      const summary = buildProjectSummary(evidence, projectId);
      if (!summary) return { projectId, found: false, note: `No project fact for "${projectId}" was found in current evidence.` };
      return { found: true, generatedAt: new Date().toISOString(), ...summary };
    },
  };

  return [...baseTools, ceoRootCauseAnalysis, ceoProjectSummary];
}
