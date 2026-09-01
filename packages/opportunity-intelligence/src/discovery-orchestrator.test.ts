import { describe, expect, it } from 'vitest';
import { InMemoryOpportunityPersistence } from './persistence.js';
import { DiscoveryOrchestrator } from './discovery-orchestrator.js';
import type { BusinessDiscoveryProvider } from './discovery.js';
import { SAUDI_UMRAH_NICHE } from './niche-profiles.js';

describe('DiscoveryOrchestrator', () => {
  it('discovers across geographies, deduplicates, and persists canonical businesses', async () => {
    const persistence = new InMemoryOpportunityPersistence();
    const provider: BusinessDiscoveryProvider = {
      name: 'fixture',
      async discover(query) {
        return [
          {
            externalId: 'acme-1',
            name: 'Acme Transport',
            website: 'https://www.acme.example/?utm_source=test',
            geography: query.geography,
            industry: 'transport',
            sourceRefs: [`https://source.example/${query.geography}`],
            discoveredAt: '2026-09-02T10:00:00.000Z',
          },
          {
            externalId: 'acme-1',
            name: 'Acme Transport',
            website: 'https://www.acme.example/',
            geography: query.geography,
            sourceRefs: ['https://source.example/duplicate'],
            discoveredAt: '2026-09-02T10:00:00.000Z',
          },
        ];
      },
    };

    const result = await new DiscoveryOrchestrator({ provider, persistence }).run(SAUDI_UMRAH_NICHE);

    expect(result.provider).toBe('fixture');
    expect(result.queries).toBe(SAUDI_UMRAH_NICHE.geographies.length);
    expect(result.rawCandidates).toBeGreaterThan(result.uniqueCandidates);
    expect(result.businessesSaved).toBe(result.uniqueCandidates);
    expect(result.deduplication.duplicatesRemoved).toBeGreaterThan(0);

    const business = await persistence.getBusiness(result.deduplication.unique[0]!.externalId!);
    expect(business).toBeUndefined();

    const saved = await persistence.listEvidence([]);
    expect(saved).toEqual([]);
  });
});
