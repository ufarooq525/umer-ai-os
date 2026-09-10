/**
 * Deterministic CEO reasoning pipeline:
 *
 *   Evidence -> Causal Analysis -> Root Cause -> Business Impact
 *   -> Recommended Action -> Governed Delegation
 *
 * Every section below is pure arithmetic/graph-walking over the evidence
 * facts already gathered by evidence.ts — nothing here calls an LLM or
 * invents a number. That is deliberate: root-cause confidence and business
 * impact must be reproducible and auditable, not generated text.
 *
 * Three kinds of statement appear in the output, and every statement is
 * explicitly tagged with which one it is:
 *   - OBSERVED_FACT   — read verbatim from an authoritative read model.
 *   - INFERENCE       — derived from observed facts, but not itself directly
 *                        observed (e.g. "this project has no linked revenue
 *                        figure, so blocked work cannot be priced").
 *   - RECOMMENDATION  — a suggested next tool call. Never executed here.
 */
import { objectInput, type EvidenceFact, type EvidenceGraph } from './evidence.js';

export type EvidenceKind = 'OBSERVED_FACT' | 'INFERENCE' | 'RECOMMENDATION';

export type CausalStep = {
  kind: 'OBSERVED_FACT';
  factType: string;
  factId: string | undefined;
  relation: string;
  evidence: unknown;
};

export type RootCauseResult =
  | {
      status: 'root_cause_established';
      kind: 'INFERENCE';
      summary: string;
      confidence: number;
      confidenceBasis: string[];
      anchor: EvidenceFact;
      chain: CausalStep[];
    }
  | {
      status: 'root_cause_not_established';
      kind: 'INFERENCE';
      summary: 'Root cause not established';
      confidence: 0;
      confidenceBasis: string[];
      missingEvidence: string[];
      anchor: EvidenceFact | null;
      chain: CausalStep[];
    };

export type BusinessImpact =
  | { kind: 'OBSERVED_FACT'; opportunityId: string; estimatedValueMin?: number; estimatedValueMax?: number; timeToRevenueDays?: number; evidence: unknown }
  | { kind: 'INFERENCE'; note: string; missingEvidence?: string[] };

export type Recommendation = {
  kind: 'RECOMMENDATION';
  tool: string;
  why: string;
  evidenceRefs: Array<string | undefined>;
};

export type DelegationEligibility = {
  registered: boolean;
  /** True if EITHER the candidate agent instance is paused OR its specialist type is suspended. */
  suspended: boolean;
  /** True specifically when the specialist *type* (not just this agent instance) is suspended company-wide. */
  specialistSuspended: boolean;
  toolAvailable: boolean;
  authorized: boolean;
  hasApproval: boolean;
  hasAcceptanceCriteria: boolean;
  failClosedReasons: string[];
};

export type GovernedDelegation = {
  kind: 'RECOMMENDATION';
  why: string;
  who: { agentId: string; specialistId?: string } | null;
  what: { type: string; goal: string; doneWhen?: string } | null;
  risk: string;
  eligibility: DelegationEligibility;
  eligible: boolean;
};

export type CeoReasoningResult = {
  generatedAt: string;
  focus: string | undefined;
  rootCause: RootCauseResult;
  businessImpact: BusinessImpact;
  recommendedActions: Recommendation[];
  governedDelegation: GovernedDelegation | null;
  authority: string;
};

const FAILED_STATUSES = new Set(['failed', 'error', 'blocked']);

function isFailed(fact: EvidenceFact): boolean {
  return FAILED_STATUSES.has(String(fact.status ?? '').toLowerCase());
}

function errorDetail(fact: EvidenceFact): string | undefined {
  const r = objectInput(fact.evidence);
  const value = r.errorMessage ?? r.error ?? r.failureReason ?? r.reason;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function findById(facts: readonly EvidenceFact[], type: string, id: string | undefined): EvidenceFact | undefined {
  if (!id) return undefined;
  return facts.find((fact) => fact.type === type && fact.id === id);
}

function correlationOf(fact: EvidenceFact): string | undefined {
  const r = objectInput(fact.evidence);
  return typeof r.correlationId === 'string' && r.correlationId.trim() ? r.correlationId.trim() : (typeof fact.relations.correlationId === 'string' ? fact.relations.correlationId : undefined);
}

/**
 * Walk from a failing fact through its known relations (work package ->
 * project, task -> project, artifact -> work package, ...) building an
 * ordered, evidence-cited chain. Stops the moment a relation cannot be
 * resolved to an actual fact already in evidence — it never guesses the
 * next hop.
 */
function buildCausalChain(facts: readonly EvidenceFact[], anchor: EvidenceFact): CausalStep[] {
  const chain: CausalStep[] = [{ kind: 'OBSERVED_FACT', factType: anchor.type, factId: anchor.id, relation: 'anchor_failure', evidence: anchor.evidence }];
  const visited = new Set<string>([`${anchor.type}:${anchor.id}`]);

  let current = anchor;
  for (let hop = 0; hop < 6; hop += 1) {
    const next =
      findById(facts, 'work_package', current.relations.workPackageId as string | undefined) ??
      findById(facts, 'task', current.relations.taskId as string | undefined) ??
      findById(facts, 'project', current.relations.projectId as string | undefined) ??
      findById(facts, 'artifact', current.relations.artifactId as string | undefined) ??
      findById(facts, 'agent', current.relations.agentId as string | undefined);
    if (!next) break;
    const key = `${next.type}:${next.id}`;
    if (visited.has(key)) break;
    visited.add(key);
    chain.push({ kind: 'OBSERVED_FACT', factType: next.type, factId: next.id, relation: `linked_via_${next.type}`, evidence: next.evidence });
    current = next;
  }
  return chain;
}

/**
 * Root Cause step of the pipeline. Deterministic, three-part evidence check:
 *   1. a concrete error/failure detail on the anchor            (weight 0.4)
 *   2. the anchor resolves to at least one structural relation   (weight 0.4)
 *   3. an audit record sharing the anchor's correlation ID       (weight 0.2)
 * Root cause is only ever "established" when checks 1 and 2 both hold —
 * check 3 only raises confidence, it never establishes a root cause alone.
 * This scoring is fixed arithmetic; nothing here is asked of an LLM.
 */
export function analyzeRootCause(evidence: EvidenceGraph): RootCauseResult {
  const { facts } = evidence;
  // `facts` is already focus-filtered by gatherEvidence(); no further
  // filtering happens here.
  const anchor = facts.find((fact) => (fact.type === 'agent_run' || fact.type === 'work_package') && isFailed(fact));

  if (!anchor) {
    return {
      status: 'root_cause_not_established',
      kind: 'INFERENCE',
      summary: 'Root cause not established',
      confidence: 0,
      confidenceBasis: [],
      missingEvidence: ['No failed or blocked agent_run/work_package fact was found in current evidence.'],
      anchor: null,
      chain: [],
    };
  }

  const chain = buildCausalChain(facts, anchor);
  const detail = errorDetail(anchor);
  const hasStructuralRelation = chain.length > 1;
  const correlationId = correlationOf(anchor);
  const auditCorroboration = correlationId ? facts.some((fact) => fact.type === 'audit' && correlationOf(fact) === correlationId) : false;

  const missingEvidence: string[] = [];
  if (!detail) missingEvidence.push(`The ${anchor.type} fact (${anchor.id ?? 'unknown id'}) has no errorMessage/error/failureReason field.`);
  if (!hasStructuralRelation) missingEvidence.push(`The ${anchor.type} fact (${anchor.id ?? 'unknown id'}) does not resolve to any linked work_package/task/project/artifact/agent fact in current evidence.`);

  let confidence = 0;
  const confidenceBasis: string[] = [];
  if (detail) { confidence += 0.4; confidenceBasis.push('anchor carries a concrete error/failure detail (+0.4)'); }
  if (hasStructuralRelation) { confidence += 0.4; confidenceBasis.push(`anchor resolves to a ${chain.length - 1}-hop structural relation chain (+0.4)`); }
  if (auditCorroboration) { confidence += 0.2; confidenceBasis.push('a correlated audit record corroborates the anchor (+0.2)'); }
  else if (correlationId) confidenceBasis.push('anchor has a correlationId but no audit record shares it (+0)');

  if (!detail || !hasStructuralRelation) {
    return {
      status: 'root_cause_not_established',
      kind: 'INFERENCE',
      summary: 'Root cause not established',
      confidence: 0,
      confidenceBasis,
      missingEvidence,
      anchor,
      chain,
    };
  }

  const terminal = chain[chain.length - 1]!;
  return {
    status: 'root_cause_established',
    kind: 'INFERENCE',
    summary: `${anchor.type} ${anchor.id ?? ''} failed: ${detail}. Traced via ${chain.length - 1} linked fact(s) to ${terminal.factType} ${terminal.factId ?? 'unknown'}.`,
    confidence: Math.min(1, confidence),
    confidenceBasis,
    anchor,
    chain,
  };
}

/**
 * Business Impact step. Only ever reports revenue/deadline figures that are
 * literally present on a linked opportunity fact (OBSERVED_FACT). If a
 * project/customer link exists but no priced opportunity does, the impact
 * is reported as an explicitly labeled INFERENCE with no invented numbers.
 * Never fabricates revenue, customers, deadlines, costs or severity.
 */
export function deriveBusinessImpact(evidence: EvidenceGraph, rootCause: RootCauseResult): BusinessImpact {
  const projectId = rootCause.chain.find((step) => step.factType === 'project')?.factId
    ?? (rootCause.anchor ? (rootCause.anchor.relations.projectId as string | undefined) : undefined);

  if (!projectId) {
    return { kind: 'INFERENCE', note: 'insufficient evidence to assess business impact', missingEvidence: ['No project is linked to the analyzed failure in current evidence.'] };
  }

  const opportunity = evidence.facts.find((fact) => fact.type === 'opportunity' && fact.relations.projectId === projectId);
  if (!opportunity) {
    return { kind: 'INFERENCE', note: `Project ${projectId} is linked to the analyzed failure, but no opportunity record with a revenue or deadline figure is linked to it in current evidence. Business impact cannot be priced without fabricating a number.` };
  }

  const o = objectInput(opportunity.evidence);
  const estimatedValueMin = typeof o.estimatedValueMin === 'number' ? o.estimatedValueMin : undefined;
  const estimatedValueMax = typeof o.estimatedValueMax === 'number' ? o.estimatedValueMax : undefined;
  const timeToRevenueDays = typeof o.timeToRevenueDays === 'number' ? o.timeToRevenueDays : undefined;

  if (estimatedValueMin === undefined && estimatedValueMax === undefined && timeToRevenueDays === undefined) {
    return { kind: 'INFERENCE', note: `Opportunity ${opportunity.id ?? 'unknown'} is linked to project ${projectId}, but carries no estimatedValueMin/estimatedValueMax/timeToRevenueDays field. Business impact cannot be priced without fabricating a number.` };
  }

  return { kind: 'OBSERVED_FACT', opportunityId: opportunity.id ?? 'unknown', estimatedValueMin, estimatedValueMax, timeToRevenueDays, evidence: opportunity.evidence };
}

/**
 * Recommended Action step. Every entry names an existing governed tool by
 * its literal registered name and cites the evidence that motivates it.
 * This function only builds data — it never calls the named tools.
 */
export function recommendActions(rootCause: RootCauseResult, evidence: EvidenceGraph): Recommendation[] {
  const recommendations: Recommendation[] = [];
  if (rootCause.status === 'root_cause_not_established') {
    if (rootCause.anchor) {
      recommendations.push({ kind: 'RECOMMENDATION', tool: 'inspect_agent_run', why: 'The anchor failure is missing evidence needed to establish a root cause; inspecting the run directly may surface it.', evidenceRefs: [rootCause.anchor.id] });
    }
    recommendations.push({ kind: 'RECOMMENDATION', tool: 'inspect_audit_trail', why: 'No sufficient evidence chain was found; the audit trail may hold the missing correlation.', evidenceRefs: [rootCause.anchor?.id] });
    return recommendations;
  }

  recommendations.push({ kind: 'RECOMMENDATION', tool: 'inspect_agent_run', why: 'Review the full authoritative run record behind this established root cause before acting.', evidenceRefs: [rootCause.anchor.id] });
  const pendingGate = evidence.pendingGates.find((gate) => rootCause.chain.some((step) => step.factId && JSON.stringify(gate).includes(step.factId)));
  if (pendingGate) {
    recommendations.push({ kind: 'RECOMMENDATION', tool: 'ceo_attention', why: 'A human gate related to this failure is still pending; review it before any remediation is delegated.', evidenceRefs: [rootCause.anchor.id] });
  } else {
    recommendations.push({ kind: 'RECOMMENDATION', tool: 'delegate_work', why: 'The root cause is established and no pending human gate blocks it; remediation can be delegated through the normal governed intake flow.', evidenceRefs: [rootCause.anchor.id] });
  }
  return recommendations;
}

export type GovernedDelegationOptions = {
  registeredToolNames: ReadonlySet<string>;
  authorize?: (action: string, resourceType: string, resourceId?: string) => Promise<{ allowed: boolean; reason?: string }>;
  approvalGranted?: boolean;
  doneWhen?: string;
  goal?: string;
  delegationType?: string;
};

/**
 * Governed Delegation step. Only produced when a recommendation actually
 * names `delegate_work`. Fails closed — `eligible` is false unless every
 * one of the six required gates passes:
 *   registered, not suspended, tool available, authorized, approved,
 *   acceptance criteria supplied.
 */
export async function evaluateGovernedDelegation(
  rootCause: RootCauseResult,
  evidence: EvidenceGraph,
  recommendations: readonly Recommendation[],
  options: GovernedDelegationOptions,
): Promise<GovernedDelegation | null> {
  const delegationRecommended = recommendations.some((r) => r.tool === 'delegate_work');
  if (!delegationRecommended || rootCause.status !== 'root_cause_established') return null;

  const projectId = rootCause.chain.find((step) => step.factType === 'project')?.factId;
  const candidateAgent = evidence.facts.find((fact) => fact.type === 'agent' && (!projectId || fact.relations.projectId === projectId));
  const agentEvidence = candidateAgent ? objectInput(candidateAgent.evidence) : {};
  const specialistId = typeof agentEvidence.specialistId === 'string' ? agentEvidence.specialistId : undefined;
  // Specialist-type suspension (SuspendSpecialist) is an orthogonal axis to
  // per-agent-instance pause: it halts new delegated work of this type
  // company-wide, regardless of which agent instance would have performed
  // it. The specialist fact set is sparse (see evidence.ts) — no fact for
  // this specialistId simply means it has never been suspended.
  const specialistFact = specialistId ? evidence.facts.find((fact) => fact.type === 'specialist' && fact.id === specialistId) : undefined;
  const specialistEvidence = specialistFact ? objectInput(specialistFact.evidence) : {};

  const registered = Boolean(candidateAgent);
  const agentSuspended = candidateAgent ? agentEvidence.controlState === 'paused' : false;
  const specialistSuspended = specialistFact ? specialistEvidence.controlState === 'suspended' : false;
  const suspended = agentSuspended || specialistSuspended;
  const toolAvailable = options.registeredToolNames.has('delegate_work');
  const hasApproval = options.approvalGranted === true;
  const hasAcceptanceCriteria = typeof options.doneWhen === 'string' && options.doneWhen.trim().length > 0;

  let authorized = false;
  if (options.authorize) {
    const decision = await options.authorize('execute', 'command', candidateAgent?.id);
    authorized = decision.allowed;
  }

  const failClosedReasons: string[] = [];
  if (!registered) failClosedReasons.push('unregistered_agent: no agent fact linked to the affected project was found in current evidence.');
  if (registered && agentSuspended) failClosedReasons.push(`suspended_agent: agent ${candidateAgent?.id} has controlState "paused" and cannot accept new delegated work.`);
  if (specialistSuspended) failClosedReasons.push(`suspended_specialist: specialist ${specialistId} is suspended company-wide${typeof specialistEvidence.reason === 'string' ? ` (${specialistEvidence.reason})` : ''} and cannot accept new delegated work regardless of which agent instance would perform it.`);
  if (!toolAvailable) failClosedReasons.push('unavailable_tool: delegate_work is not among the currently registered JARVIS tools.');
  if (!authorized) failClosedReasons.push('insufficient_authority: no Trust "execute" grant on "command" was confirmed for the calling principal.');
  if (!hasApproval) failClosedReasons.push('missing_approval: no explicit CEO approval was supplied for this specific delegation.');
  if (!hasAcceptanceCriteria) failClosedReasons.push('missing_acceptance_criteria: no doneWhen acceptance criteria was supplied for this delegation.');

  return {
    kind: 'RECOMMENDATION',
    why: rootCause.summary,
    who: candidateAgent ? { agentId: candidateAgent.id ?? 'unknown', specialistId } : null,
    what: options.goal ? { type: options.delegationType ?? 'bug', goal: options.goal, doneWhen: options.doneWhen } : null,
    risk: 'This is a recommendation only. delegate_work still creates a normal gated intake/Work Package — it does not bypass human gates. Explicit approval and acceptance criteria are required before it is invoked.',
    eligibility: { registered, suspended, specialistSuspended, toolAvailable, authorized, hasApproval, hasAcceptanceCriteria, failClosedReasons },
    eligible: failClosedReasons.length === 0,
  };
}

export type BuildCeoReasoningOptions = GovernedDelegationOptions;

/**
 * Top-level entry point: Evidence -> Causal Analysis -> Root Cause ->
 * Business Impact -> Recommended Action -> Governed Delegation.
 */
export async function buildCeoReasoning(evidence: EvidenceGraph, options: BuildCeoReasoningOptions): Promise<CeoReasoningResult> {
  const rootCause = analyzeRootCause(evidence);
  const businessImpact = deriveBusinessImpact(evidence, rootCause);
  const recommendedActions = recommendActions(rootCause, evidence);
  const governedDelegation = await evaluateGovernedDelegation(rootCause, evidence, recommendedActions, options);

  return {
    generatedAt: new Date().toISOString(),
    focus: evidence.focus,
    rootCause,
    businessImpact,
    recommendedActions,
    governedDelegation,
    authority: 'Root cause, business impact and confidence are computed deterministically from authoritative read models. Recommendations name governed tools but are never executed by this analysis.',
  };
}
