import { describe, expect, it, vi } from 'vitest';
import type { NicheDefinition } from '@umer/contracts';
import {
  DefaultOpportunityPipeline,
  type DiscoveryCandidate,
  type EvidenceRecord,
} from './pipeline.js';

const niche: NicheDefinition = {
  id: 'test-niche',
  name: 'Test niche',
  description: 'A bounded test niche',
  geographies: ['global'],
  status: 'testing',
  priority: 'high',
  targetBusinessesPerRun: 2,
  minimumOpportunityScore: 70,
  researchDepth: 'standard',
  problemHypotheses: [],
  discoverySignals: ['public websites'],
  allowedSolutionTypes: ['service', 'product'],
  outreachMode: 'approval_required',
  createdAt: '2026-09-02T00:00:00.000Z',
  updatedAt: '2026-09-02T00:00:00.000Z',
};

const candidate = (name: string): DiscoveryCandidate => ({
  name,
  geography: 'global',
  sourceRefs: [`source:${name}`],
});

const evidence = (name: string): EvidenceRecord => ({
  id: `evidence:${name}`,
  sourceUrl: `https://example.com/${name}`,
  type: 'website',
  observedAt: '2026-09-02T00:00:00.000Z',
  observation: 'Public evidence',
  strength: 'strong',
  title: `Public evidence for ${name}`,
  supports: [],
  contradicts: [],
});

describe('DefaultOpportunityPipeline', () => {
  it('enforces the niche research quota', async () => {
    const discovery = { discover: vi.fn().mockResolvedValue([candidate('one'), candidate('two'), candidate('three')]) };
    const research = { research: vi.fn(async (c) => [evidence(c.name)]) };
    const problemDetector = { detect: vi.fn().mockResolvedValue([]) };
    const opportunityBuilder = { build: vi.fn().mockResolvedValue([]) };

    const result = await new DefaultOpportunityPipeline(
      discovery,
      research,
      problemDetector,
      opportunityBuilder,
    ).run(niche, 'run-1');

    expect(result.discovered).toBe(3);
    expect(result.researched).toBe(2);
    expect(research.research).toHaveBeenCalledTimes(2);
  });

  it('isolates candidate failures and continues the run', async () => {
    const discovery = { discover: vi.fn().mockResolvedValue([candidate('good'), candidate('bad')]) };
    const research = {
      research: vi.fn(async (c) => {
        if (c.name === 'bad') throw new Error('source unavailable');
        return [evidence(c.name)];
      }),
    };
    const problemDetector = { detect: vi.fn().mockResolvedValue([]) };
    const opportunityBuilder = { build: vi.fn().mockResolvedValue([]) };

    const result = await new DefaultOpportunityPipeline(
      discovery,
      research,
      problemDetector,
      opportunityBuilder,
    ).run(niche, 'run-2');

    expect(result.researched).toBe(1);
    expect(result.evidence).toHaveLength(1);
    expect(result.errors).toEqual([
      { stage: 'research', message: 'source unavailable', candidate: 'bad' },
    ]);
  });
});
