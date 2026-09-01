import type { BusinessProspect, NicheDefinition } from '@umer/contracts';
import { buildBusinessIdentity } from './identity.js';
import { deduplicateCandidates, type DeduplicationResult } from './dedup.js';
import type { BusinessDiscoveryProvider, DiscoveryQuery } from './discovery.js';
import type { DiscoveryCandidate } from './pipeline.js';
import type { OpportunityPersistence } from './persistence.js';

export type DiscoveryOrchestratorOptions = { provider: BusinessDiscoveryProvider; persistence: OpportunityPersistence; now?: () => string };
export type DiscoveryRunResult = {
  provider: string; queries: number; rawCandidates: number; uniqueCandidates: number; businessesSaved: number;
  errors: Array<{ query: string; geography: string; message: string }>;
  deduplication: DeduplicationResult;
};

export class DiscoveryOrchestrator {
  constructor(private readonly options: DiscoveryOrchestratorOptions) {}

  async run(niche: NicheDefinition): Promise<DiscoveryRunResult> {
    const now = this.options.now ?? (() => new Date().toISOString());
    const candidates: DiscoveryCandidate[] = [];
    const errors: DiscoveryRunResult['errors'] = [];
    let queries = 0;

    for (const geography of niche.geographies) {
      const query: DiscoveryQuery = { niche, geography, query: `${niche.name} ${geography}`, limit: niche.targetBusinessesPerRun };
      queries += 1;
      try {
        const results = await this.options.provider.discover(query);
        candidates.push(...results.slice(0, query.limit).map((candidate) => ({
          externalId: candidate.externalId,
          name: candidate.name,
          geography: candidate.geography || geography,
          ...(candidate.industry ? { industry: candidate.industry } : {}),
          ...(candidate.website ? { websiteUrl: candidate.website } : {}),
          sourceRefs: [...new Set(candidate.sourceRefs)],
        })));
      } catch (error) {
        errors.push({ query: query.query, geography, message: this.message(error) });
      }
    }

    const deduplication = deduplicateCandidates(candidates);
    let businessesSaved = 0;
    for (const candidate of deduplication.unique) {
      const identity = buildBusinessIdentity({ externalId: candidate.externalId, name: candidate.name, websiteUrl: candidate.websiteUrl, geography: candidate.geography });
      const business: BusinessProspect = {
        id: identity.id,
        name: candidate.name,
        ...(identity.canonicalWebsite ? { website: identity.canonicalWebsite } : {}),
        geography: candidate.geography,
        ...(candidate.industry ? { industry: candidate.industry } : {}),
        nicheId: niche.id,
        sourceRefs: candidate.sourceRefs,
        discoveredAt: now(),
      };
      await this.options.persistence.saveBusiness(business);
      businessesSaved += 1;
    }

    return { provider: this.options.provider.name, queries, rawCandidates: candidates.length, uniqueCandidates: deduplication.unique.length, businessesSaved, errors, deduplication };
  }

  private message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
}
