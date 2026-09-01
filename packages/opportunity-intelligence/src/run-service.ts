import { randomUUID } from 'node:crypto';
import type { NicheDefinition, NicheRunMetrics, Opportunity } from '@umer/contracts';
import type { DiscoveryCandidate, DiscoveryAdapter, OpportunityBuilder, ProblemDetector, ResearchAdapter, EvidenceRecord } from './pipeline.js';
import { deduplicateCandidates } from './normalization.js';
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

    const candidates = deduplicateCandidates(rawCandidates).slice(0, niche.targetBusinessesPerRun);
    let researched = 0;
    let qualified = 0;

    for (const candidate of candidates) {
      try {
        const businessId = candidate.externalId ?? this.businessId(candidate);
        const evidence = await this.options.research.research(candidate);
        allEvidence.push(...evidence);
        for (const item of evidence) await this.options.persistence.saveEvidence(item);
        researched += 1;

        await this.options.persistence.saveBusiness({
          id: businessId,
          name: candidate.name,
          website: candidate.websiteUrl,
          geography: candidate.geography,
          industry: candidate.industry,
          nicheId: niche.id,
          sourceRefs: [...new Set(candidate.sourceRefs)],
          discoveredAt: startedAt,
          lastResearchedAt: this.clock.nowIso(),
        });

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
    const estimatedPipeline = highValue.reduce((sum, item) => {
      const value = item.estimatedValueMax ?? item.estimatedValueMin ?? 0;
      return sum + value;
    }, 0);

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

  private businessId(candidate: DiscoveryCandidate): string {
    const source = candidate.websiteUrl ?? `${candidate.name}|${candidate.geography}`;
    return `biz_${Buffer.from(source.toLowerCase()).toString('base64url').slice(0, 40)}`;
  }

  private message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
}
