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

async function requestJson(
  baseUrl: string,
  path: string,
  init: RequestInit | undefined,
  fetchImpl: typeof fetch,
): Promise<unknown> {
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

function boundedInteger(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
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
    parameters: {
      type: 'object',
      properties: { opportunityLimit: { type: 'integer', minimum: 1, maximum: 20 } },
      additionalProperties: false,
    },
    execute: async (input) => {
      const body = objectInput(input);
      const limit = boundedInteger(body.opportunityLimit, 10, 1, 20);
      const [dashboard, agents, opportunities] = await Promise.all([
        requestJson(baseUrl, '/v1/dashboard', { method: 'GET' }, fetchImpl),
        requestJson(baseUrl, '/v1/agents', { method: 'GET' }, fetchImpl),
        requestJson(baseUrl, '/v1/opportunities', { method: 'GET' }, fetchImpl),
      ]);
      const opportunityList = opportunities && typeof opportunities === 'object' && !Array.isArray(opportunities)
        ? { ...(opportunities as Record<string, unknown>), opportunities: Array.isArray((opportunities as Record<string, unknown>).opportunities) ? ((opportunities as Record<string, unknown>).opportunities as unknown[]).slice(0, limit) : [] }
        : opportunities;
      return {
        generatedAt: new Date().toISOString(),
        source: 'control-api-read-models',
        dashboard,
        agents,
        opportunities: opportunityList,
      };
    },
  };

  const listAgents: JarvisTool = {
    name: 'list_agents',
    description: 'Read the currently registered AI workforce and their current project/task state from the control plane.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    execute: async () => requestJson(baseUrl, '/v1/agents', { method: 'GET' }, fetchImpl),
  };

  const listAgentRuns: JarvisTool = {
    name: 'list_agent_runs',
    description: 'Inspect real agent-run observability records. Use when the CEO asks what agents have completed, what is running, what failed, or when a run is blocked. This is read-only and never invents runs.',
    parameters: {
      type: 'object',
      properties: { status: { type: 'string', enum: ['running', 'completed', 'failed'] } },
      additionalProperties: false,
    },
    execute: async (input) => {
      const body = objectInput(input);
      const status = body.status === 'running' || body.status === 'completed' || body.status === 'failed' ? body.status : undefined;
      return requestJson(baseUrl, status ? `/v1/agent-runs?status=${encodeURIComponent(status)}` : '/v1/agent-runs', { method: 'GET' }, fetchImpl);
    },
  };

  const getAgentRun: JarvisTool = {
    name: 'get_agent_run',
    description: 'Inspect one authoritative agent run by work-package ID, including its current observability snapshot. Use after a failure, blocker, or when the CEO asks why a specific run is in its current state.',
    parameters: {
      type: 'object',
      properties: { workPackageId: { type: 'string' } },
      required: ['workPackageId'],
      additionalProperties: false,
    },
    execute: async (input) => {
      const body = objectInput(input);
      if (typeof body.workPackageId !== 'string' || !body.workPackageId.trim()) throw new Error('workPackageId is required');
      return requestJson(baseUrl, `/v1/agent-runs/${encodeURIComponent(body.workPackageId.trim())}`, { method: 'GET' }, fetchImpl);
    },
  };

  const listWorkPackages: JarvisTool = {
    name: 'list_work_packages',
    description: 'Read real work packages and their specialist, stage, project, status, artifact and error fields. Use to explain exactly what work is in flight or awaiting review.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    execute: async () => requestJson(baseUrl, '/v1/work-packages', { method: 'GET' }, fetchImpl),
  };

  const listTasks: JarvisTool = {
    name: 'list_tasks',
    description: 'Read real work-management tasks. Use to map agents to specific project work, inspect blockers/status, or understand the execution plan. Optional filters: project or agent.',
    parameters: {
      type: 'object',
      properties: { projectId: { type: 'string' }, agentId: { type: 'string' }, status: { type: 'string' } },
      additionalProperties: false,
    },
    execute: async (input) => {
      const body = objectInput(input);
      const params = new URLSearchParams();
      if (typeof body.projectId === 'string' && body.projectId.trim()) params.set('project', body.projectId.trim());
      if (typeof body.agentId === 'string' && body.agentId.trim()) params.set('agent', body.agentId.trim());
      if (typeof body.status === 'string' && body.status.trim()) params.set('status', body.status.trim());
      const suffix = params.toString() ? `?${params.toString()}` : '';
      return requestJson(baseUrl, `/v1/tasks${suffix}`, { method: 'GET' }, fetchImpl);
    },
  };

  const listOpportunities: JarvisTool = {
    name: 'list_opportunities',
    description: 'Read current business opportunities from the Umer AI OS opportunity read model. Use when the CEO asks about opportunities or revenue pipeline.',
    parameters: {
      type: 'object',
      properties: { limit: { type: 'integer', minimum: 1, maximum: 50 }, status: { type: 'string' } },
      additionalProperties: false,
    },
    execute: async (input) => {
      const body = objectInput(input);
      const limit = boundedInteger(body.limit, 20, 1, 50);
      const params = new URLSearchParams({ });
      if (typeof body.status === 'string' && body.status.trim()) params.set('status', body.status.trim());
      const result = await requestJson(baseUrl, `/v1/opportunities${params.toString() ? `?${params.toString()}` : ''}`, { method: 'GET' }, fetchImpl);
      if (!result || typeof result !== 'object' || Array.isArray(result)) return result;
      const record = result as Record<string, unknown>;
      return { ...record, opportunities: Array.isArray(record.opportunities) ? record.opportunities.slice(0, limit) : [] };
    },
  };

  const retrieveMemory: JarvisTool = {
    name: 'retrieve_memory',
    description: 'Retrieve relevant governed JARVIS memory. Use for prior decisions, lessons, research, patterns and working context. Treat returned citations as memory evidence, not current system state.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'integer', minimum: 1, maximum: 10 },
        memoryKinds: {
          type: 'array',
          items: { type: 'string', enum: ['Lesson', 'Pattern', 'BestPractice', 'Research', 'DecisionIntel', 'CaseStudy', 'WorkingNote'] },
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
    execute: async (input) => {
      const body = objectInput(input);
      if (typeof body.query !== 'string' || !body.query.trim()) throw new Error('query is required');
      const memoryKinds = Array.isArray(body.memoryKinds)
        ? body.memoryKinds.filter((v): v is 'Lesson' | 'Pattern' | 'BestPractice' | 'Research' | 'DecisionIntel' | 'CaseStudy' | 'WorkingNote' => typeof v === 'string')
        : undefined;
      return memory.retrieve(body.query.trim(), {
        limit: typeof body.limit === 'number' ? body.limit : undefined,
        memoryKinds,
      });
    },
  };

  const delegateWork: JarvisTool = {
    name: 'delegate_work',
    description: 'Create a governed work intake through the existing Umer AI OS control plane. This does not bypass gates or execute irreversible work; it creates the normal intake/work-package flow for the appropriate specialist.',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        type: { type: 'string', enum: ['qa', 'seo', 'security', 'perf', 'ux', 'feature', 'bug'] },
        goal: { type: 'string' },
        doneWhen: { type: 'string' },
        constraints: { type: 'array', items: { type: 'string' } },
      },
      required: ['projectId', 'type', 'goal'],
      additionalProperties: false,
    },
    execute: async (input) => {
      const body = objectInput(input);
      if (typeof body.projectId !== 'string' || typeof body.type !== 'string' || typeof body.goal !== 'string') {
        throw new Error('projectId, type and goal are required');
      }
      return requestJson(baseUrl, '/v1/intake', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          projectId: body.projectId,
          type: body.type,
          goal: body.goal,
          doneWhen: typeof body.doneWhen === 'string' ? body.doneWhen : undefined,
          constraints: Array.isArray(body.constraints) ? body.constraints.filter((v): v is string => typeof v === 'string') : undefined,
        }),
      }, fetchImpl);
    },
  };

  return [systemSnapshot, ceoBriefing, listAgents, listAgentRuns, getAgentRun, listWorkPackages, listTasks, listOpportunities, retrieveMemory, delegateWork];
}
