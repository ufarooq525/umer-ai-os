import { describe, expect, it } from 'vitest';
import type { EvidenceFact, EvidenceGraph } from './evidence.js';
import {
  analyzeRootCause,
  deriveBusinessImpact,
  recommendActions,
  evaluateGovernedDelegation,
  buildCeoReasoning,
  type GovernedDelegationOptions,
} from './reasoning.js';

function fact(type: string, id: string, status: unknown, relations: Record<string, unknown>, evidenceExtra: Record<string, unknown> = {}): EvidenceFact {
  return { type, source: `${type}s`, id, status, relations, evidence: { id, status, ...evidenceExtra } };
}

function graph(facts: EvidenceFact[], pendingGates: unknown[] = []): EvidenceGraph {
  return { focus: undefined, limit: 50, counts: {}, facts, pendingGates, dashboard: {} };
}

const project = fact('project', 'P1', 'active', {});
const workPackage = fact('work_package', 'WP1', 'failed', { projectId: 'P1' }, { projectId: 'P1' });
const failedRun = fact('agent_run', 'AR1', 'failed', { workPackageId: 'WP1', projectId: 'P1' }, {
  workPackageId: 'WP1',
  projectId: 'P1',
  errorMessage: 'Connection refused to database',
  correlationId: 'corr-123',
});
const correlatedAudit = fact('audit', 'AU1', undefined, { correlationId: 'corr-123' }, { correlationId: 'corr-123', action: 'agent_run.failed' });
const pricedOpportunity = fact('opportunity', 'OPP1', undefined, { projectId: 'P1' }, {
  projectId: 'P1',
  estimatedValueMin: 5000,
  estimatedValueMax: 8000,
  timeToRevenueDays: 14,
});
const unpricedOpportunity = fact('opportunity', 'OPP2', undefined, { projectId: 'P1' }, { projectId: 'P1' });
const activeAgent = fact('agent', 'AG1', 'active', { projectId: 'P1' }, { projectId: 'P1', specialistId: 'eng.app-delivery', controlState: 'active' });
const suspendedAgent = fact('agent', 'AG1', 'active', { projectId: 'P1' }, { projectId: 'P1', specialistId: 'eng.app-delivery', controlState: 'paused' });

const fullDelegationOptions: GovernedDelegationOptions = {
  registeredToolNames: new Set(['inspect_agent_run', 'inspect_audit_trail', 'list_tasks', 'list_work_packages', 'ceo_attention', 'delegate_work']),
  authorize: async () => ({ allowed: true }),
  approvalGranted: true,
  doneWhen: 'Database connection pool no longer errors under load for 24h.',
  goal: 'Fix the database connection failure causing AR1 to fail.',
  delegationType: 'bug',
};

describe('ceo_root_cause_analysis — known failure chain', () => {
  it('establishes a root cause when a failure resolves to a full evidence chain with correlated audit', () => {
    const result = analyzeRootCause(graph([failedRun, workPackage, project, correlatedAudit, pricedOpportunity, activeAgent]));
    expect(result.status).toBe('root_cause_established');
    if (result.status !== 'root_cause_established') throw new Error('unreachable');
    expect(result.anchor.id).toBe('AR1');
    expect(result.chain.map((step) => step.factId)).toEqual(['AR1', 'WP1', 'P1']);
    expect(result.confidence).toBe(1);
  });
});

describe('ceo_root_cause_analysis — missing relationship', () => {
  it('does not establish a root cause when the failing fact has no resolvable structural relation', () => {
    const orphanRun = fact('agent_run', 'AR2', 'failed', { workPackageId: 'WP-DOES-NOT-EXIST' }, {
      workPackageId: 'WP-DOES-NOT-EXIST',
      errorMessage: 'Connection refused',
    });
    const result = analyzeRootCause(graph([orphanRun]));
    expect(result.status).toBe('root_cause_not_established');
    if (result.status !== 'root_cause_not_established') throw new Error('unreachable');
    expect(result.missingEvidence.join(' ')).toMatch(/does not resolve to any linked/);
    expect(result.confidence).toBe(0);
  });
});

describe('ceo_root_cause_analysis — no fabricated root cause', () => {
  it('reports "Root cause not established" and names the missing evidence when no failure fact exists at all', () => {
    const result = analyzeRootCause(graph([project, pricedOpportunity]));
    expect(result.status).toBe('root_cause_not_established');
    expect(result.summary).toBe('Root cause not established');
    if (result.status !== 'root_cause_not_established') throw new Error('unreachable');
    expect(result.missingEvidence).toHaveLength(1);
    expect(result.missingEvidence[0]).toMatch(/No failed or blocked agent_run\/work_package fact was found/);
    expect(result.anchor).toBeNull();
  });

  it('never invents a confidence score when evidence is insufficient', () => {
    const orphanRun = fact('agent_run', 'AR3', 'failed', {}, {});
    const result = analyzeRootCause(graph([orphanRun]));
    expect(result.confidence).toBe(0);
  });
});

describe('ceo_root_cause_analysis — business impact', () => {
  it('reports an OBSERVED_FACT business impact only when a linked opportunity carries a real value/deadline field', () => {
    const rootCause = analyzeRootCause(graph([failedRun, workPackage, project, pricedOpportunity]));
    const impact = deriveBusinessImpact(graph([failedRun, workPackage, project, pricedOpportunity]), rootCause);
    expect(impact.kind).toBe('OBSERVED_FACT');
    if (impact.kind !== 'OBSERVED_FACT') throw new Error('unreachable');
    expect(impact.opportunityId).toBe('OPP1');
    expect(impact.estimatedValueMin).toBe(5000);
    expect(impact.estimatedValueMax).toBe(8000);
    expect(impact.timeToRevenueDays).toBe(14);
  });

  it('labels business impact as an explicit INFERENCE (never a fabricated number) when no priced opportunity is linked', () => {
    const evidence = graph([failedRun, workPackage, project, unpricedOpportunity]);
    const rootCause = analyzeRootCause(evidence);
    const impact = deriveBusinessImpact(evidence, rootCause);
    expect(impact.kind).toBe('INFERENCE');
    if (impact.kind !== 'INFERENCE') throw new Error('unreachable');
    expect(impact.note).toMatch(/carries no estimatedValueMin\/estimatedValueMax\/timeToRevenueDays/);
    expect(impact).not.toHaveProperty('estimatedValueMin');
  });

  it('labels business impact as insufficient evidence when no project is even linked', () => {
    const orphanRun = fact('agent_run', 'AR4', 'failed', {}, { errorMessage: 'boom' });
    const evidence = graph([orphanRun]);
    const rootCause = analyzeRootCause(evidence);
    const impact = deriveBusinessImpact(evidence, rootCause);
    expect(impact.kind).toBe('INFERENCE');
    if (impact.kind !== 'INFERENCE') throw new Error('unreachable');
    expect(impact.missingEvidence).toEqual(['No project is linked to the analyzed failure in current evidence.']);
  });
});

describe('ceo_root_cause_analysis — recommendation/tool mapping', () => {
  it('recommends inspect_agent_run and inspect_audit_trail (never a fabricated tool) when root cause is not established', () => {
    const orphanRun = fact('agent_run', 'AR2', 'failed', {}, {});
    const evidence = graph([orphanRun]);
    const rootCause = analyzeRootCause(evidence);
    const recs = recommendActions(rootCause, evidence);
    expect(recs.map((r) => r.tool)).toEqual(['inspect_agent_run', 'inspect_audit_trail']);
    for (const rec of recs) expect(rec.kind).toBe('RECOMMENDATION');
  });

  it('recommends delegate_work when root cause is established and no gate is pending', () => {
    const evidence = graph([failedRun, workPackage, project]);
    const rootCause = analyzeRootCause(evidence);
    const recs = recommendActions(rootCause, evidence);
    expect(recs.map((r) => r.tool)).toEqual(['inspect_agent_run', 'delegate_work']);
  });

  it('recommends ceo_attention instead of delegate_work when a related gate is still pending', () => {
    const evidence = graph([failedRun, workPackage, project], [{ workPackageId: 'WP1', gateId: 'gate-1' }]);
    const rootCause = analyzeRootCause(evidence);
    const recs = recommendActions(rootCause, evidence);
    expect(recs.map((r) => r.tool)).toEqual(['inspect_agent_run', 'ceo_attention']);
  });
});

describe('ceo_root_cause_analysis — no automatic execution', () => {
  it('only ever returns plain recommendation data; it never invokes delegate_work or any other tool', async () => {
    const delegateWorkSpy = { calls: 0 };
    const authorizeSpy = { calls: 0 };
    const evidence = graph([failedRun, workPackage, project, correlatedAudit, activeAgent]);
    const result = await buildCeoReasoning(evidence, {
      ...fullDelegationOptions,
      authorize: async (...args) => { authorizeSpy.calls += 1; return fullDelegationOptions.authorize!(...args); },
    });

    // The only side effect this analysis is allowed to trigger is checking
    // Trust authority — never actually calling delegate_work or any other
    // governed tool. Nothing in this module holds a reference to a real
    // delegate_work executor at all, so delegateWorkSpy can only stay at 0.
    expect(authorizeSpy.calls).toBe(1);
    expect(delegateWorkSpy.calls).toBe(0);

    expect(result.recommendedActions.some((r) => r.tool === 'delegate_work')).toBe(true);
    expect(result.governedDelegation).not.toBeNull();
    expect(result.governedDelegation!.eligible).toBe(true);
    expect(result.authority).toMatch(/never executed/);

    // The result is plain, serializable data — no functions, no promises,
    // nothing left to "run" later.
    const roundTripped = JSON.parse(JSON.stringify(result));
    const definedKeys = Object.keys(result).filter((key) => (result as Record<string, unknown>)[key] !== undefined);
    expect(Object.keys(roundTripped).sort()).toEqual(definedKeys.sort());
    expect(typeof roundTripped.governedDelegation.eligible).toBe('boolean');
  });
});

describe('ceo_root_cause_analysis — governed delegation fails closed', () => {
  it('fails closed for a suspended agent', async () => {
    const evidence = graph([failedRun, workPackage, project, suspendedAgent]);
    const rootCause = analyzeRootCause(evidence);
    const recs = recommendActions(rootCause, evidence);
    const delegation = await evaluateGovernedDelegation(rootCause, evidence, recs, fullDelegationOptions);
    expect(delegation).not.toBeNull();
    expect(delegation!.eligibility.suspended).toBe(true);
    expect(delegation!.eligible).toBe(false);
    expect(delegation!.eligibility.failClosedReasons.join(' ')).toMatch(/suspended_agent/);
  });

  it('fails closed for an unregistered agent (no agent linked to the affected project)', async () => {
    const evidence = graph([failedRun, workPackage, project]);
    const rootCause = analyzeRootCause(evidence);
    const recs = recommendActions(rootCause, evidence);
    const delegation = await evaluateGovernedDelegation(rootCause, evidence, recs, fullDelegationOptions);
    expect(delegation!.eligibility.registered).toBe(false);
    expect(delegation!.eligible).toBe(false);
    expect(delegation!.eligibility.failClosedReasons.join(' ')).toMatch(/unregistered_agent/);
  });

  it('fails closed when the delegate_work tool itself is not registered', async () => {
    const evidence = graph([failedRun, workPackage, project, activeAgent]);
    const rootCause = analyzeRootCause(evidence);
    const recs = recommendActions(rootCause, evidence);
    const delegation = await evaluateGovernedDelegation(rootCause, evidence, recs, { ...fullDelegationOptions, registeredToolNames: new Set(['inspect_agent_run']) });
    expect(delegation!.eligibility.toolAvailable).toBe(false);
    expect(delegation!.eligible).toBe(false);
  });

  it('fails closed when Trust denies authority', async () => {
    const evidence = graph([failedRun, workPackage, project, activeAgent]);
    const rootCause = analyzeRootCause(evidence);
    const recs = recommendActions(rootCause, evidence);
    const delegation = await evaluateGovernedDelegation(rootCause, evidence, recs, { ...fullDelegationOptions, authorize: async () => ({ allowed: false, reason: 'no grant' }) });
    expect(delegation!.eligibility.authorized).toBe(false);
    expect(delegation!.eligible).toBe(false);
    expect(delegation!.eligibility.failClosedReasons.join(' ')).toMatch(/insufficient_authority/);
  });

  it('fails closed by default when no explicit approval is supplied', async () => {
    const evidence = graph([failedRun, workPackage, project, activeAgent]);
    const rootCause = analyzeRootCause(evidence);
    const recs = recommendActions(rootCause, evidence);
    const delegation = await evaluateGovernedDelegation(rootCause, evidence, recs, { ...fullDelegationOptions, approvalGranted: undefined });
    expect(delegation!.eligibility.hasApproval).toBe(false);
    expect(delegation!.eligible).toBe(false);
    expect(delegation!.eligibility.failClosedReasons.join(' ')).toMatch(/missing_approval/);
  });

  it('fails closed when no acceptance criteria (doneWhen) is supplied', async () => {
    const evidence = graph([failedRun, workPackage, project, activeAgent]);
    const rootCause = analyzeRootCause(evidence);
    const recs = recommendActions(rootCause, evidence);
    const delegation = await evaluateGovernedDelegation(rootCause, evidence, recs, { ...fullDelegationOptions, doneWhen: undefined });
    expect(delegation!.eligibility.hasAcceptanceCriteria).toBe(false);
    expect(delegation!.eligible).toBe(false);
  });

  it('is eligible only once every gate passes', async () => {
    const evidence = graph([failedRun, workPackage, project, activeAgent]);
    const rootCause = analyzeRootCause(evidence);
    const recs = recommendActions(rootCause, evidence);
    const delegation = await evaluateGovernedDelegation(rootCause, evidence, recs, fullDelegationOptions);
    expect(delegation!.eligibility.failClosedReasons).toEqual([]);
    expect(delegation!.eligible).toBe(true);
    expect(delegation!.who).toEqual({ agentId: 'AG1', specialistId: 'eng.app-delivery' });
  });
});

describe('ceo_root_cause_analysis — correlation ID preservation', () => {
  it('raises confidence only when an audit record shares the anchor correlation ID', () => {
    const withCorrelatedAudit = analyzeRootCause(graph([failedRun, workPackage, project, correlatedAudit]));
    const withoutAudit = analyzeRootCause(graph([failedRun, workPackage, project]));
    expect(withCorrelatedAudit.confidence).toBe(1);
    expect(withoutAudit.confidence).toBe(0.8);
    expect(withCorrelatedAudit.confidenceBasis.join(' ')).toMatch(/correlated audit record corroborates/);
  });

  it('does not corroborate on an unrelated correlation ID', () => {
    const uncorrelatedAudit = fact('audit', 'AU2', undefined, { correlationId: 'corr-999' }, { correlationId: 'corr-999' });
    const result = analyzeRootCause(graph([failedRun, workPackage, project, uncorrelatedAudit]));
    expect(result.confidence).toBe(0.8);
    expect(result.confidenceBasis.join(' ')).toMatch(/no audit record shares it/);
  });
});
