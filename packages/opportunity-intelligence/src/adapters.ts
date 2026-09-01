import type { EvidenceRecord, NicheDefinition } from '@umer/contracts';
import type { BusinessDiscoveryProvider, BusinessCandidate, DiscoveryQuery } from './discovery.js';
import type { DiscoveryAdapter, DiscoveryCandidate, ResearchAdapter } from './pipeline.js';

/** Provider-neutral normalized discovery source. Real vendors can implement this contract without entering domain code. */
export type DiscoverySource = {
  readonly name: string;
  search(query: DiscoveryQuery): Promise<BusinessCandidate[]>;
};

export class SourceDiscoveryProvider implements BusinessDiscoveryProvider {
  readonly name: string;

  constructor(private readonly sources: DiscoverySource[], name = 'composite-discovery') {
    this.name = name;
  }

  async discover(query: DiscoveryQuery): Promise<BusinessCandidate[]> {
    const results: BusinessCandidate[] = [];
    for (const source of this.sources) results.push(...await source.search(query));
    return results;
  }
}

/** Deterministic adapter for fixtures, imports and local development. */
export class StaticDiscoverySource implements DiscoverySource {
  readonly name = 'static';

  constructor(private readonly candidates: BusinessCandidate[]) {}

  async search(query: DiscoveryQuery): Promise<BusinessCandidate[]> {
    const geography = query.geography.trim().toLocaleLowerCase();
    return this.candidates.filter((candidate) => candidate.geography.trim().toLocaleLowerCase() === geography);
  }
}

export class CompositeDiscoveryAdapter implements DiscoveryAdapter {
  constructor(private readonly provider: BusinessDiscoveryProvider) {}

  async discover(niche: NicheDefinition): Promise<DiscoveryCandidate[]> {
    const all: DiscoveryCandidate[] = [];
    for (const geography of niche.geographies) {
      const results = await this.provider.discover({
        niche,
        geography,
        query: `${niche.name} ${geography}`,
        limit: niche.targetBusinessesPerRun,
      });
      all.push(...results.map((item) => ({
        externalId: item.externalId,
        name: item.name,
        geography: item.geography || geography,
        industry: item.industry,
        websiteUrl: item.website,
        sourceRefs: [...new Set(item.sourceRefs)],
      })));
    }
    return all;
  }
}

export type EvidenceSource = {
  readonly name: string;
  collect(candidate: DiscoveryCandidate, niche?: NicheDefinition): Promise<EvidenceRecord[]>;
};

/** Provider-neutral research adapter. It only consumes normalized evidence from approved sources. */
export class EvidenceResearchAdapter implements ResearchAdapter {
  constructor(private readonly sources: EvidenceSource[], private readonly niche?: NicheDefinition) {}

  async research(candidate: DiscoveryCandidate): Promise<EvidenceRecord[]> {
    const evidence: EvidenceRecord[] = [];
    for (const source of this.sources) evidence.push(...await source.collect(candidate, this.niche));
    const unique = new Map<string, EvidenceRecord>();
    for (const item of evidence) unique.set(item.id, item);
    return [...unique.values()];
  }
}

export class StaticEvidenceSource implements EvidenceSource {
  readonly name = 'static';

  constructor(private readonly records: EvidenceRecord[]) {}

  async collect(candidate: DiscoveryCandidate): Promise<EvidenceRecord[]> {
    const prefix = candidate.websiteUrl ? candidate.websiteUrl : candidate.name;
    return this.records.filter((record) => record.title.toLocaleLowerCase().includes(prefix.toLocaleLowerCase()) || record.observation.toLocaleLowerCase().includes(candidate.name.toLocaleLowerCase()));
  }
}
