import { describe, expect, it } from 'vitest';
import type { EvidenceRecord, NicheDefinition, Opportunity } from '@umer/contracts';
import { InMemoryOpportunityPersistence } from './persistence.js';
import { OpportunityRunService } from './run-service.js';
import type { DiscoveryAdapter, DiscoveryCandidate, OpportunityBuilder, ProblemDetector, ResearchAdapter } from './pipeline.js';

const niche: NicheDefinition = {
  id: 'niche-test',
  name: 'Test niche',
  description: 'A deterministic test niche',
  geographies: ['Pakistan'],
  status: 'testing',
  priority: 'high',
  targetBusinessesPerRun: 2,
  minimumOpportunityScore: 70,
  researchDepth: 'standard',
  problemHypotheses: ['Manual quoting'],
  discoverySignals: ['Website', 'Reviews'],
  allowedSolutionTypes: ['service'],
  outreachMode: 'approval_required',
  createdAt: '2026-09-02T10:00:00.000Z',
  updatedAt: '2026-09-02T10:00:00.000Z',
};

const candidates: DiscoveryCandidate[] = [
  { externalId: 'b-1', name: 'Alpha Transport', geography: 'Pakistan', websiteUrl: 'https://alpha.example', sourceRefs: ['search:1'] },
  { externalId: 'b-1', name: 'Alpha Transport Duplicate', geography: 'Pakistan', websiteUrl: 'https://alpha.example', sourceRefs: ['directory:2'] },
  { externalId: 'b-2', name: 'Beta Transport', geography: 'Pakistan', sourceRefs: ['search:3'] },
  { externalId: 'b-3', name: 'Gamma Transport', geography: 'Pakistan', sourceRefs: ['search:4'] },
];

const evidenceFor = (candidate: DiscoveryCandidate): EvidenceRecord => ({
  id: `e-${candidate.externalId}`,
  type: 'website',
  title: 'Manual quote workflow',
  sourceUrl: candidate.websiteUrl ?? 'https://example.com/source',
  observedAt: '2026-09-02T10:01:00.000Z',
  observation: 'Customers are asked to contact the business for a quote.',
  strength: 'strong',
  supports: ['manual-quoting'],
  contradicts: [],
});

const discovery: DiscoveryAdapter = { discover: async () => candidates };
const research: ResearchAdapter = { research: async (candidate) => [evidenceFor(candidate)] };
const problemDetector: ProblemDetector = {
  detect: async (candidate, evidence) => [{
    id: `p-${candidate.externalId}`,
    statement: 'Quoting is manual',
    severity: 85,
    frequency: 80,
    financialImpact: 75,
    evidenceConfidence: evidence.length ? 90 : 0,
    evidenceRefs: evidence.map((item) => item.id),
  }],
};
const opportunityBuilder: OpportunityBuilder = {
  build: async ({ niche, candidate, evidence }) => [{
    id: `o-${candidate.externalId}`,
    type: 'service',
    title: `Quote automation for ${candidate.name}`,
    geography: candidate.geography,
    market: niche.name,
    nicheId: niche.id,
    businessId: candidate.externalId,
    problemIds: [`p-${candidate.externalId}`],
    score: {
      problemSeverity: 85,
      demandEvidence: 80,
      abilityToPay: 75,
      reachability: 80,
      solutionFit: 90,
      competitiveGap: 70,
      deliveryFeasibility: 90,
      evidenceConfidence: 90,
      overall: 82,
      recommendation: 'outreach_ready',
    },
    estimatedValueMin: 1000,
    estimatedValueMax: 2000,
    currency: 'USD',
    timeToRevenueDays: 14,
    evidenceRefs: evidence.map((item) => item.id),
    status: 'outreach_ready',
    createdAt: '2026-09-02T10:02:00.000Z',
    updatedAt: '2026-09-02T10:02:00.000Z',
  }] as Opportunity[],
};

describe('OpportunityRunService', () => {
  it('deduplicates, enforces quota, persists evidence/opportunities, and records metrics', async () => {
    const persistence = new InMemoryOpportunityPersistence();
    const service = new OpportunityRunService({
      discovery,
      research,
      problemDetector,
      opportunityBuilder,
      persistence,
      clock: { nowIso: () => '2026-09-02T10:03:00.000Z' },
    });

    const result = await service.execute(niche, 'run-1');

    expect(result.metrics.businessesDiscovered).toBe(4);
    expect(result.metrics.businessesResearched).toBe(2);
    expect(result.metrics.opportunitiesFound).toBe(2);
    expect(result.metrics.highValueOpportunities).toBe(2);
    expect(result.metrics.estimatedPipeline).toBe(4000);
    expect(result.errors).toHaveLength(0);
    expect(await persistence.getEvidence('e-b-1')).toBeDefined();
    expect(await persistence.getOpportunity('o-b-2')).toBeDefined();
    expect((await persistence.listOpportunities('niche-test'))).toHaveLength(2);
  });

  it('isolates candidate failures and still records a completed run', async () => {
    const persistence = new InMemoryOpportunityPersistence();
    const failingResearch: ResearchAdapter = {
      research: async (candidate) => {
        if (candidate.externalId === 'b-2') throw new Error('research unavailable');
        return [evidenceFor(candidate)];
      },
    };
    const service = new OpportunityRunService({
      discovery,
      research: failingResearch,
      problemDetector,
      opportunityBuilder,
      persistence,
      clock: { nowIso: () => '2026-09-02T10:03:00.000Z' },
    });

    const result = await service.execute(niche, 'run-2');

    expect(result.metrics.businessesResearched).toBe(1);
    expect(result.metrics.errors).toBe(1);
    expect(result.errors[0]?.candidate).toBe('Beta Transport');
    expect((await persistence.listOpportunities('niche-test'))).toHaveLength(1);
  });
});
