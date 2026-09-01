import { createHash, randomUUID } from 'node:crypto';
import type { BusinessProspect, EvidenceRecord, NicheDefinition, NicheRunMetrics, Opportunity } from '@umer/contracts';
import type { DiscoveryCandidate, DiscoveryAdapter, OpportunityBuilder, ProblemDetector, ResearchAdapter } from './pipeline.js';
import { deduplicateCandidates } from './dedup.js';
import { normalizeCandidate } from './normalization.js';
import type { OpportunityPersistence } from './persistence.js';

export type OpportunityRunClock = { nowIso(): string };
export const defaultOpportunityRunClock: OpportunityRunClock = { nowIso: () => new Date().toISOString() };

export type OpportunityRunResult = {
  runId: string;
  nicheId: string;
  metrics: NicheRunMetrics;
  opportunities: Opportunity[];
  evidence: EvidenceRecord[];
  errors: Array<{ stage: string; message: string; candidate?: string }>;
};

export type OpportunityRunServiceOptions = {
  discovery: DiscoveryAdapter;
  research: ResearchAdapter;
  problemDetector: ProblemDetector;
  opportunityBuilder: OpportunityBuilder;
  persistence: OpportunityPersistence;
  clock?: OpportunityRunClock;
};

export class OpportunityRunService {
  private readonly clock: OpportunityRunClock;

  constructor(private readonly options: OpportunityRunServiceOptions) {
    this.clock = options.clock ?? defaultOpportunityRunClock;
  }

  async execute(niche: NicheDefinition, runId = randomUUID()): Promise<OpportunityRunResult> {
    const startedAt = this.clock.nowIso();
    await this.options.persistence.saveNiche(niche);
    const errors: OpportunityRunResult['errors'] = [];
    const allEvidence: EvidenceRecord[] = [];
    const opportunities: Opportunity[] = [];
    let rawCandidates: DiscoveryCandidate[] = [];

    try {
      rawCandidates = await this.options.discovery.discover(niche);
    } catch (error) {
      errors.push({ stage: 'discovery', message: this.message(error) });
    }

    const deduplicated = deduplicateCandidates(rawCandidates);
    const candidates = deduplicated.unique.slice(0, niche.targetBusinessesPerRun);
    let researched = 0;
    let qualified = 0;

    for (const candidate of candidates) {
      try {
        const businessId = candidate.externalId?.trim()
          ? this.businessId(`external:${candidate.externalId.trim()}`)
          : this.businessId(candidate);
        const evidence = await this.options.research.research(candidate);
        allEvidence.push(...evidence);
        for (const item of evidence) await this.options.persistence.saveEvidence(item);
        researched += 1;

        const business: BusinessProspect = {
          id: businessId,
          name: candidate.name,
          ...(candidate.websiteUrl ? { website: candidate.websiteUrl } : {}),
          geography: candidate.geography,
          ...(candidate.industry ? { industry: candidate.industry } : {}),
          nicheId: niche.id,
          sourceRefs: [...new Set(candidate.sourceRefs)],
          discoveredAt: startedAt,
          lastResearchedAt: this.clock.nowIso(),
        };
        await this.options.persistence.saveBusiness(business);

        const problems = await this.options.problemDetector.detect(candidate, evidence);
        if (problems.length > 0) qualified += 1;
        const built = await this.options.opportunityBuilder.build({ niche, candidate, evidence, problems });
        for (const opportunity of built) {
          await this.options.persistence.saveOpportunity(opportunity);
          opportunities.push(opportunity);
        }
      } catch (error) {
        errors.push({ stage: 'candidate', message: this.message(error), candidate: candidate.name });
      }
    }

    const highValue = opportunities.filter((item) => item.score.overall >= niche.minimumOpportunityScore);
    const estimatedPipeline = highValue.reduce((sum, item) => sum + (item.estimatedValueMax ?? item.estimatedValueMin ?? 0), 0);

    const metrics: NicheRunMetrics = {
      nicheId: niche.id,
      runId,
      businessesDiscovered: rawCandidates.length,
      businessesResearched: researched,
      qualifiedBusinesses: qualified,
      opportunitiesFound: opportunities.length,
      highValueOpportunities: highValue.length,
      estimatedPipeline,
      errors: errors.length,
      startedAt,
      completedAt: this.clock.nowIso(),
    };
    await this.options.persistence.saveRunMetrics(metrics);

    return { runId, nicheId: niche.id, metrics, opportunities, evidence: allEvidence, errors };
  }

  private businessId(candidate: DiscoveryCandidate | string): string {
    const identity = typeof candidate === 'string'
      ? candidate
      : (() => {
          const normalized = normalizeCandidate(candidate);
          return normalized.normalizedWebsite
            ? `website:${normalized.normalizedWebsite}`
            : `name:${normalized.normalizedName}|geo:${candidate.geography.trim().toLocaleLowerCase().normalize('NFKC')}`;
        })();

    return `biz_${createHash('sha256').update(identity, 'utf8').digest('hex')}`;
  }

  private message(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
