import type { JarvisTool } from '@umer/jarvis-core';
import { createJarvisMemory, type JarvisMemory } from '@umer/jarvis-memory';

export type JarvisControlToolsOptions = {
  controlApiBaseUrl?: string;
  fetchImpl?: typeof fetch;
  memory?: JarvisMemory;
};

function objectInput(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  return input as Record<string, unknown>;
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

export function createJarvisControlTools(options: JarvisControlToolsOptions = {}): JarvisTool[] {
  const baseUrl = options.controlApiBaseUrl ?? process.env.CONTROL_API_BASE_URL ?? 'http://127.0.0.1:3002';
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
      return { generatedAt: new Date().toISOString(), source: 'control-api-read-models', dashboard, agents, opportunities, failedRuns, audit };
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
      for (const run of runs) attention.push({ severity: 'high', source: 'failed_agent_run', evidence: run, recommendedNextStep: 'Inspect the failed run and its error evidence before retrying or delegating new work.' });
      return {
        generatedAt: new Date().toISOString(),
        source: 'control-api-read-models',
        attention,
        counts: { watchdogFindings: findings.length, pendingGates: gates.length, failedRuns: runs.length },
        recentAudit: records.slice(-20),
        dashboard,
      };
    },
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
      return { records: records.filter((record) => {
        const r = objectInput(record);
        return (!body.correlationId || r.correlationId === body.correlationId) && (!body.actor || r.actor === body.actor) && (!body.action || r.action === body.action);
      }) };
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
    execute: async (input) => {
      const body = objectInput(input);
      if (typeof body.query !== 'string' || !body.query.trim()) throw new Error('query is required');
      const memoryKinds = Array.isArray(body.memoryKinds) ? body.memoryKinds.filter((v): v is 'Lesson' | 'Pattern' | 'BestPractice' | 'Research' | 'DecisionIntel' | 'CaseStudy' | 'WorkingNote' => typeof v === 'string') : undefined;
      return memory.retrieve(body.query.trim(), { limit: typeof body.limit === 'number' ? body.limit : undefined, memoryKinds });
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

  return [systemSnapshot, ceoBriefing, ceoAttention, listAgents, inspectAgentRuns, inspectAgentRun, listWorkPackages, listTasks, listOpportunities, listAudit, listArtifacts, inspectArtifact, retrieveMemory, delegateWork];
}
