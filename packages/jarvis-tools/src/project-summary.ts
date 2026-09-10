/**
 * Project-level CEO summary — a distinct, narrower slice of the same
 * deterministic evidence used by ceo_intelligence/ceo_root_cause_analysis,
 * scoped to one project. "Where data exists" is deliberate: a section is
 * only populated when a matching fact is actually present; it is never
 * padded with an invented placeholder.
 */
import { objectInput, type EvidenceFact, type EvidenceGraph } from './evidence.js';

const TERMINAL_WORK_PACKAGE_STATUSES = new Set(['accepted', 'rejected', 'cancelled', 'failed', 'completed', 'done', 'succeeded', 'error']);
const TERMINAL_TASK_STATUSES = new Set(['done', 'completed', 'cancelled', 'failed']);
const FAILED_RUN_STATUSES = new Set(['failed', 'error']);

function isActive(status: unknown, terminal: ReadonlySet<string>): boolean {
  return !terminal.has(String(status ?? '').toLowerCase());
}

export type ProjectSummary = {
  kind: 'OBSERVED_FACT';
  projectId: string;
  currentState: unknown | null;
  activeAgents: EvidenceFact[];
  activeTasks: EvidenceFact[];
  activeWorkPackages: EvidenceFact[];
  failedRuns: EvidenceFact[];
  pendingGates: unknown[];
  recentArtifacts: EvidenceFact[];
  opportunities: EvidenceFact[];
  blockers: Array<{ kind: 'INFERENCE'; reason: string; evidenceRef: string | undefined }>;
  businessImpact: { kind: 'OBSERVED_FACT'; opportunityId: string; estimatedValueMin?: number; estimatedValueMax?: number; timeToRevenueDays?: number } | { kind: 'INFERENCE'; note: string };
  recommendedNextAction: Array<{ kind: 'RECOMMENDATION'; tool: string; why: string }>;
};

/**
 * Builds a project-level CEO summary. Returns `null` (rather than an
 * empty-but-shaped object) when the project itself is not found in
 * evidence — an unknown project has no summary, not a summary of nothing.
 */
export function buildProjectSummary(evidence: EvidenceGraph, projectId: string): ProjectSummary | null {
  const project = evidence.facts.find((fact) => fact.type === 'project' && fact.id === projectId);
  if (!project) return null;

  const linkedTo = (fact: EvidenceFact) => fact.relations.projectId === projectId;
  const workPackages = evidence.facts.filter((fact) => fact.type === 'work_package' && linkedTo(fact));
  const workPackageIds = new Set(workPackages.map((fact) => fact.id).filter((id): id is string => Boolean(id)));

  const agents = evidence.facts.filter((fact) => fact.type === 'agent' && linkedTo(fact));
  const tasks = evidence.facts.filter((fact) => fact.type === 'task' && linkedTo(fact));
  const runs = evidence.facts.filter((fact) => fact.type === 'agent_run' && (linkedTo(fact) || (typeof fact.relations.workPackageId === 'string' && workPackageIds.has(fact.relations.workPackageId))));
  const artifacts = evidence.facts.filter((fact) => fact.type === 'artifact' && typeof fact.relations.workPackageId === 'string' && workPackageIds.has(fact.relations.workPackageId));
  const opportunities = evidence.facts.filter((fact) => fact.type === 'opportunity' && linkedTo(fact));
  const pendingGates = evidence.pendingGates.filter((gate) => {
    const g = objectInput(gate);
    return (typeof g.workPackageId === 'string' && workPackageIds.has(g.workPackageId)) || g.projectId === projectId;
  });

  const activeAgents = agents.filter((fact) => isActive(fact.status, new Set(['offline'])));
  const activeTasks = tasks.filter((fact) => isActive(fact.status, TERMINAL_TASK_STATUSES));
  const activeWorkPackages = workPackages.filter((fact) => isActive(fact.status, TERMINAL_WORK_PACKAGE_STATUSES));
  const failedRuns = runs.filter((fact) => FAILED_RUN_STATUSES.has(String(fact.status ?? '').toLowerCase()));

  const blockedWorkPackages = workPackages.filter((fact) => String(fact.status ?? '').toLowerCase() === 'failed');
  const blockers: ProjectSummary['blockers'] = [
    ...failedRuns.map((fact) => ({ kind: 'INFERENCE' as const, reason: `agent_run ${fact.id ?? 'unknown'} is failed and may be blocking downstream work.`, evidenceRef: fact.id })),
    ...blockedWorkPackages.map((fact) => ({ kind: 'INFERENCE' as const, reason: `work_package ${fact.id ?? 'unknown'} is failed.`, evidenceRef: fact.id })),
    ...pendingGates.map((gate) => ({ kind: 'INFERENCE' as const, reason: 'A human gate is pending and blocks further automated progress.', evidenceRef: objectInput(gate).gateId as string | undefined })),
  ];

  const pricedOpportunity = opportunities.find((fact) => {
    const o = objectInput(fact.evidence);
    return typeof o.estimatedValueMin === 'number' || typeof o.estimatedValueMax === 'number' || typeof o.timeToRevenueDays === 'number';
  });
  const businessImpact: ProjectSummary['businessImpact'] = pricedOpportunity
    ? (() => {
        const o = objectInput(pricedOpportunity.evidence);
        return {
          kind: 'OBSERVED_FACT' as const,
          opportunityId: pricedOpportunity.id ?? 'unknown',
          estimatedValueMin: typeof o.estimatedValueMin === 'number' ? o.estimatedValueMin : undefined,
          estimatedValueMax: typeof o.estimatedValueMax === 'number' ? o.estimatedValueMax : undefined,
          timeToRevenueDays: typeof o.timeToRevenueDays === 'number' ? o.timeToRevenueDays : undefined,
        };
      })()
    : { kind: 'INFERENCE' as const, note: opportunities.length > 0 ? `Project ${projectId} has ${opportunities.length} linked opportunity record(s), but none carries a revenue or deadline figure.` : `Project ${projectId} has no linked opportunity record; business impact cannot be priced without fabricating a number.` };

  const recommendedNextAction: ProjectSummary['recommendedNextAction'] = [];
  if (failedRuns.length > 0) recommendedNextAction.push({ kind: 'RECOMMENDATION', tool: 'inspect_agent_run', why: `${failedRuns.length} agent run(s) on this project are failed.` });
  if (pendingGates.length > 0) recommendedNextAction.push({ kind: 'RECOMMENDATION', tool: 'ceo_attention', why: `${pendingGates.length} human gate(s) on this project are still pending.` });
  if (activeWorkPackages.length > 0) recommendedNextAction.push({ kind: 'RECOMMENDATION', tool: 'list_work_packages', why: 'Review current Work Package status and specialist assignment for this project.' });
  if (recommendedNextAction.length === 0) recommendedNextAction.push({ kind: 'RECOMMENDATION', tool: 'list_tasks', why: 'No failures or pending gates were found for this project; review task status for a general update.' });

  return {
    kind: 'OBSERVED_FACT',
    projectId,
    currentState: project.evidence,
    activeAgents,
    activeTasks,
    activeWorkPackages,
    failedRuns,
    pendingGates,
    recentArtifacts: artifacts,
    opportunities,
    blockers,
    businessImpact,
    recommendedNextAction,
  };
}
