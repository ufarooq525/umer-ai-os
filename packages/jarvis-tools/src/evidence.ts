/**
 * Shared evidence-gathering over the control-api read models. Extracted from
 * `ceo_intelligence` so `ceo_root_cause_analysis` (reasoning.ts) correlates
 * the exact same authoritative facts instead of re-implementing the fetch +
 * normalization logic a second time.
 */

export function objectInput(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  return input as Record<string, unknown>;
}

export function firstString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) if (typeof record[key] === 'string' && record[key].trim()) return record[key].trim();
  return undefined;
}

export function matchesFocus(record: unknown, focus: string | undefined): boolean {
  if (!focus) return true;
  const r = objectInput(record);
  const needle = focus.toLowerCase();
  return Object.values(r).some((value) => typeof value === 'string' && value.toLowerCase().includes(needle));
}

export type EvidenceFact = {
  type: string;
  source: string;
  id: string | undefined;
  status: unknown;
  relations: Record<string, unknown>;
  evidence: unknown;
};

export type EvidenceGraph = {
  focus: string | undefined;
  limit: number;
  counts: Record<string, number>;
  facts: EvidenceFact[];
  pendingGates: unknown[];
  dashboard: Record<string, unknown>;
};

export type RequestJson = (path: string, init?: RequestInit) => Promise<unknown>;

/**
 * Fetch and normalize the authoritative read models used by both
 * `ceo_intelligence` and `ceo_root_cause_analysis` into one flat fact list.
 * Every fact carries its literal source read model and, where derivable, the
 * IDs of related facts (projectId, workPackageId, correlationId, ...) so
 * downstream reasoning can walk real relationships instead of guessing them.
 */
export async function gatherEvidence(requestJson: RequestJson, focus: string | undefined, limit: number): Promise<EvidenceGraph> {
  const [dashboard, agents, runs, tasks, audit, artifacts, opportunities] = await Promise.all([
    requestJson('/v1/dashboard', { method: 'GET' }),
    requestJson('/v1/agents', { method: 'GET' }),
    requestJson('/v1/agent-runs', { method: 'GET' }),
    requestJson('/v1/tasks', { method: 'GET' }),
    requestJson('/v1/audit/recent', { method: 'GET' }),
    requestJson('/v1/artifacts', { method: 'GET' }),
    requestJson('/v1/opportunities?limit=50', { method: 'GET' }),
  ]);

  const d = objectInput(dashboard);
  const agentsObj = objectInput(agents);
  const tasksObj = objectInput(tasks);
  const runsObj = objectInput(runs);
  const artifactsObj = objectInput(artifacts);
  const opportunitiesObj = objectInput(opportunities);
  const auditObj = objectInput(audit);
  const collections = {
    agents: Array.isArray(agentsObj.agents) ? agentsObj.agents : [],
    projects: Array.isArray(d.projects) ? d.projects : Array.isArray(d.workProjects) ? d.workProjects : [],
    tasks: Array.isArray(tasksObj.tasks) ? tasksObj.tasks : [],
    workPackages: Array.isArray(d.workPackages) ? d.workPackages : [],
    runs: Array.isArray(runsObj.agentRuns) ? runsObj.agentRuns : [],
    artifacts: Array.isArray(artifactsObj.artifacts) ? artifactsObj.artifacts : [],
    opportunities: Array.isArray(opportunitiesObj.opportunities) ? opportunitiesObj.opportunities : [],
    audit: Array.isArray(auditObj.records) ? auditObj.records : [],
  };

  const filtered = Object.fromEntries(Object.entries(collections).map(([kind, records]) => [kind, records.filter((record) => matchesFocus(record, focus)).slice(0, limit)]));
  const facts: EvidenceFact[] = [];
  const addFact = (type: string, source: string, record: unknown, relations: Record<string, unknown> = {}) => {
    const r = objectInput(record);
    facts.push({ type, source, id: firstString(r, ['id', 'agentId', 'taskId', 'workPackageId', 'artifactId', 'opportunityId', 'projectId', 'correlationId']), status: r.status, relations, evidence: record });
  };

  for (const record of filtered.agents) addFact('agent', 'agents', record, { projectId: firstString(objectInput(record), ['projectId', 'project']), taskId: firstString(objectInput(record), ['taskId', 'task']) });
  for (const record of filtered.projects) addFact('project', 'dashboard.workProjects', record);
  for (const record of filtered.tasks) addFact('task', 'tasks', record, { agentId: firstString(objectInput(record), ['agentId', 'agent']), projectId: firstString(objectInput(record), ['projectId', 'project']), workPackageId: firstString(objectInput(record), ['workPackageId']) });
  for (const record of filtered.workPackages) addFact('work_package', 'dashboard.workPackages', record, { agentId: firstString(objectInput(record), ['agentId', 'specialistId', 'agent']), projectId: firstString(objectInput(record), ['projectId', 'project']), taskId: firstString(objectInput(record), ['taskId', 'task']), runId: firstString(objectInput(record), ['runId', 'executionId']), artifactId: firstString(objectInput(record), ['artifactId']) });
  for (const record of filtered.runs) addFact('agent_run', 'agent-runs', record, { workPackageId: firstString(objectInput(record), ['workPackageId']), agentId: firstString(objectInput(record), ['agentId', 'specialistId']), projectId: firstString(objectInput(record), ['projectId']), artifactId: firstString(objectInput(record), ['artifactId']) });
  for (const record of filtered.artifacts) addFact('artifact', 'artifacts', record, { execId: firstString(objectInput(record), ['execId', 'executionId']), workPackageId: firstString(objectInput(record), ['workPackageId']) });
  for (const record of filtered.opportunities) addFact('opportunity', 'opportunities', record, { projectId: firstString(objectInput(record), ['projectId']), owner: firstString(objectInput(record), ['owner', 'agentId']) });
  for (const record of filtered.audit) addFact('audit', 'audit', record, { correlationId: firstString(objectInput(record), ['correlationId']), actor: firstString(objectInput(record), ['actor', 'principalId']) });

  const pendingGates = (Array.isArray(d.pendingGates) ? d.pendingGates : []).filter((gate) => matchesFocus(gate, focus));

  return {
    focus,
    limit,
    counts: Object.fromEntries(Object.entries(collections).map(([kind, records]) => [kind, records.length])),
    facts,
    pendingGates,
    dashboard: d,
  };
}
