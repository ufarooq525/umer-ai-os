import type { JarvisTool } from '@umer/jarvis-core';

export type JarvisControlToolsOptions = {
  controlApiBaseUrl?: string;
  fetchImpl?: typeof fetch;
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
  const response = await fetchImpl(`${baseUrl.replace(/\\/$/, '')}${path}`, {
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

  const systemSnapshot: JarvisTool = {
    name: 'control_plane_snapshot',
    description: 'Read the authoritative Umer AI OS control-plane dashboard: agents, active runs, work packages, pending gates, opportunities, artifacts and CEO attention. Use this for questions about current system activity.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    execute: async () => requestJson(baseUrl, '/v1/dashboard', { method: 'GET' }, fetchImpl),
  };

  const listAgents: JarvisTool = {
    name: 'list_agents',
    description: 'Read the currently registered AI workforce and their current project/task state from the control plane.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    execute: async () => requestJson(baseUrl, '/v1/agents', { method: 'GET' }, fetchImpl),
  };

  const listOpportunities: JarvisTool = {
    name: 'list_opportunities',
    description: 'Read current business opportunities from the Umer AI OS opportunity read model. Use when the CEO asks about opportunities or revenue pipeline.',
    parameters: {
      type: 'object',
      properties: { limit: { type: 'integer', minimum: 1, maximum: 50 } },
      additionalProperties: false,
    },
    execute: async (input) => {
      const { limit = 20 } = objectInput(input);
      const n = Number(limit);
      const suffix = Number.isInteger(n) && n >= 1 && n <= 50 ? `?limit=${n}` : '?limit=20';
      return requestJson(baseUrl, `/v1/opportunities${suffix}`, { method: 'GET' }, fetchImpl);
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

  return [systemSnapshot, listAgents, listOpportunities, delegateWork];
}
