import { describe, expect, it } from 'vitest';
import { gatherEvidence } from './evidence.js';

const fixtures: Record<string, unknown> = {
  '/v1/dashboard': { projects: [{ id: 'P1', status: 'active' }], workPackages: [{ id: 'WP1', status: 'failed', projectId: 'P1' }], pendingGates: [{ gateId: 'gate-1', workPackageId: 'WP1' }] },
  '/v1/agents': { agents: [{ agentId: 'AG1', specialistId: 'eng.app-delivery', projectId: 'P1', controlState: 'active' }] },
  '/v1/agent-runs': { agentRuns: [{ workPackageId: 'WP1', projectId: 'P1', status: 'failed', errorMessage: 'boom', correlationId: 'corr-1' }] },
  '/v1/tasks': { tasks: [{ taskId: 'T1', projectId: 'P1' }] },
  '/v1/audit/recent': { records: [{ id: 'AU1', correlationId: 'corr-1', actor: 'system' }] },
  '/v1/artifacts': { artifacts: [{ artifactId: 'ART1', workPackageId: 'WP1' }] },
  '/v1/opportunities?limit=50': { opportunities: [{ id: 'OPP1', projectId: 'P1', estimatedValueMin: 100 }] },
  '/v1/specialists': { specialists: [{ specialistId: 'security.review', controlState: 'suspended', reason: 'incident' }] },
};

async function fakeRequestJson(path: string): Promise<unknown> {
  if (!(path in fixtures)) throw new Error(`unexpected path: ${path}`);
  return fixtures[path];
}

describe('gatherEvidence', () => {
  it('normalizes every read model into a flat, relation-annotated fact list', async () => {
    const evidence = await gatherEvidence(fakeRequestJson, undefined, 50);
    expect(evidence.counts).toEqual({ agents: 1, projects: 1, tasks: 1, workPackages: 1, runs: 1, artifacts: 1, opportunities: 1, audit: 1, specialists: 1 });
    expect(evidence.facts).toHaveLength(9);

    const run = evidence.facts.find((f) => f.type === 'agent_run');
    expect(run?.relations).toEqual({ workPackageId: 'WP1', agentId: undefined, projectId: 'P1', artifactId: undefined });

    const opportunity = evidence.facts.find((f) => f.type === 'opportunity');
    expect(opportunity?.relations.projectId).toBe('P1');

    const specialist = evidence.facts.find((f) => f.type === 'specialist');
    expect(specialist?.id).toBe('security.review');
    expect((specialist?.evidence as { controlState: string }).controlState).toBe('suspended');

    expect(evidence.pendingGates).toEqual([{ gateId: 'gate-1', workPackageId: 'WP1' }]);
  });

  it('applies the focus filter to every collection, including pending gates', async () => {
    const evidence = await gatherEvidence(fakeRequestJson, 'nonexistent-keyword', 50);
    expect(evidence.facts).toHaveLength(0);
    expect(evidence.pendingGates).toHaveLength(0);
  });

  it('is the same normalization ceo_intelligence and ceo_root_cause_analysis both build on', async () => {
    const first = await gatherEvidence(fakeRequestJson, undefined, 50);
    const second = await gatherEvidence(fakeRequestJson, undefined, 50);
    expect(first.facts.map((f) => f.id).sort()).toEqual(second.facts.map((f) => f.id).sort());
  });
});
