import { describe, expect, it } from 'vitest';
import type { EvidenceFact, EvidenceGraph } from './evidence.js';
import { buildProjectSummary } from './project-summary.js';

function fact(type: string, id: string, status: unknown, relations: Record<string, unknown>, evidenceExtra: Record<string, unknown> = {}): EvidenceFact {
  return { type, source: `${type}s`, id, status, relations, evidence: { id, status, ...evidenceExtra } };
}

function graph(facts: EvidenceFact[], pendingGates: unknown[] = []): EvidenceGraph {
  return { focus: undefined, limit: 100, counts: {}, facts, pendingGates, dashboard: {} };
}

describe('buildProjectSummary', () => {
  it('returns null for an unknown project rather than an empty-but-shaped summary', () => {
    expect(buildProjectSummary(graph([]), 'no-such-project')).toBeNull();
  });

  it('populates each section only where matching evidence exists', () => {
    const project = fact('project', 'P1', 'active', {});
    const activeWorkPackage = fact('work_package', 'WP1', 'Running', { projectId: 'P1' }, { projectId: 'P1' });
    const failedWorkPackage = fact('work_package', 'WP2', 'failed', { projectId: 'P1' }, { projectId: 'P1' });
    const activeAgent = fact('agent', 'AG1', 'active', { projectId: 'P1' }, { projectId: 'P1' });
    const activeTask = fact('task', 'T1', 'in_progress', { projectId: 'P1' }, { projectId: 'P1' });
    const doneTask = fact('task', 'T2', 'done', { projectId: 'P1' }, { projectId: 'P1' });
    const failedRun = fact('agent_run', 'AR1', 'failed', { workPackageId: 'WP2', projectId: 'P1' }, { workPackageId: 'WP2', projectId: 'P1' });
    const artifact = fact('artifact', 'ART1', undefined, { workPackageId: 'WP1' }, { workPackageId: 'WP1' });
    const pricedOpportunity = fact('opportunity', 'OPP1', undefined, { projectId: 'P1' }, { projectId: 'P1', estimatedValueMin: 2000 });
    const unrelatedProject = fact('project', 'P2', 'active', {});

    const evidence = graph(
      [project, activeWorkPackage, failedWorkPackage, activeAgent, activeTask, doneTask, failedRun, artifact, pricedOpportunity, unrelatedProject],
      [{ gateId: 'gate-1', workPackageId: 'WP2' }],
    );

    const summary = buildProjectSummary(evidence, 'P1');
    expect(summary).not.toBeNull();
    expect(summary!.activeWorkPackages.map((f) => f.id)).toEqual(['WP1']);
    expect(summary!.failedRuns.map((f) => f.id)).toEqual(['AR1']);
    expect(summary!.activeAgents.map((f) => f.id)).toEqual(['AG1']);
    expect(summary!.activeTasks.map((f) => f.id)).toEqual(['T1']);
    expect(summary!.recentArtifacts.map((f) => f.id)).toEqual(['ART1']);
    expect(summary!.pendingGates).toHaveLength(1);
    expect(summary!.opportunities.map((f) => f.id)).toEqual(['OPP1']);
    expect(summary!.businessImpact).toEqual({ kind: 'OBSERVED_FACT', opportunityId: 'OPP1', estimatedValueMin: 2000, estimatedValueMax: undefined, timeToRevenueDays: undefined });
    expect(summary!.blockers.length).toBeGreaterThanOrEqual(2);
    expect(summary!.recommendedNextAction.map((r) => r.tool)).toContain('inspect_agent_run');
    expect(summary!.recommendedNextAction.map((r) => r.tool)).toContain('ceo_attention');
  });

  it('labels business impact as an explicit INFERENCE, never a fabricated number, when no priced opportunity is linked', () => {
    const project = fact('project', 'P1', 'active', {});
    const summary = buildProjectSummary(graph([project]), 'P1');
    expect(summary!.businessImpact.kind).toBe('INFERENCE');
    if (summary!.businessImpact.kind !== 'INFERENCE') throw new Error('unreachable');
    expect(summary!.businessImpact.note).toMatch(/no linked opportunity record/);
  });

  it('recommends a generic status-check action when nothing is failing or pending', () => {
    const project = fact('project', 'P1', 'active', {});
    const activeWorkPackage = fact('work_package', 'WP1', 'Running', { projectId: 'P1' }, { projectId: 'P1' });
    const summary = buildProjectSummary(graph([project, activeWorkPackage]), 'P1');
    expect(summary!.failedRuns).toHaveLength(0);
    expect(summary!.pendingGates).toHaveLength(0);
    expect(summary!.recommendedNextAction.map((r) => r.tool)).toEqual(['list_work_packages']);
  });
});
