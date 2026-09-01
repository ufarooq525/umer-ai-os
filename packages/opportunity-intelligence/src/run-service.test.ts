import { describe, expect, it } from 'vitest';
import type { EvidenceRecord } from '@umer/contracts';
import { EvidenceBasedProblemDetector } from './business-audit.js';
import { CompositeDiscoveryAdapter, EvidenceResearchAdapter, StaticDiscoverySource, StaticEvidenceSource, SourceDiscoveryProvider } from './adapters.js';
import { DefaultOpportunityBuilder } from './opportunity-builder.js';
import { InMemoryOpportunityPersistence } from './persistence.js';
import { SAUDI_UMRAH_NICHE } from './niche-profiles.js';
import { OpportunityRunService } from './run-service.js';

const evidence: EvidenceRecord[] = [
  {
    id: 'ev-hotel-1', type: 'website', title: 'Example Makkah Hotel website',
    sourceUrl: 'https://example.test', observedAt: '2026-09-02T00:00:00.000Z',
    observation: 'Website displays static contact phone and address only without modern interactive features.',
    strength: 'verified', supports: ['digital presence'], contradicts: [],
  },
];

const niche = { ...SAUDI_UMRAH_NICHE, targetBusinessesPerRun: 10, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-02T00:00:00.000Z' };

const candidate = {
  externalId: 'hotel-1', name: 'Example Makkah Hotel', geography: 'Makkah', industry: 'hotel',
  website: 'https://example.test', sourceRefs: ['fixture://discovery/hotel-1'],
};

describe('opportunity run adapters', () => {
  it('runs discovery -> research -> problems -> opportunities -> persistence', async () => {
    const provider = new SourceDiscoveryProvider([new StaticDiscoverySource([candidate])]);
    const discovery = new CompositeDiscoveryAdapter(provider);
    const research = new EvidenceResearchAdapter([new StaticEvidenceSource(evidence)], niche);
    const persistence = new InMemoryOpportunityPersistence();
    const service = new OpportunityRunService({
      discovery,
      research,
      problemDetector: new EvidenceBasedProblemDetector(),
      opportunityBuilder: new DefaultOpportunityBuilder(),
      persistence,
      clock: { nowIso: () => '2026-09-02T00:00:00.000Z' },
    });

    const result = await service.execute(niche, 'run-fixture-1');

    expect(result.errors).toEqual([]);
    expect(result.metrics.businessesDiscovered).toBe(1);
    expect(result.metrics.businessesResearched).toBe(1);
    expect(result.metrics.qualifiedBusinesses).toBe(1);
    expect(result.metrics.opportunitiesFound).toBeGreaterThan(0);
    expect(result.evidence).toHaveLength(1);
    expect(await persistence.getBusiness(result.opportunities[0]!.businessId!)).toBeDefined();
    expect((await persistence.listOpportunities(niche.id)).length).toBe(result.opportunities.length);
  });
});
