import type {
  DiscoveryCandidateRecord,
  NicheDefinition,
  OpportunityRunEvent,
  ResearchCase,
} from '@umer/contracts';
import { createHash, randomUUID } from 'node:crypto';
import type { DiscoveryCandidate, DiscoveryAdapter, OpportunityBuilder, ProblemDetector, ResearchAdapter } from './pipeline.js';
import { deduplicateCandidates } from './dedup.js';
import { buildBusinessIdentity } from './identity.js';
import type { OpportunityPersistence } from './persistence.js';
import { DefaultOutreachGenerator, type OutreachGenerator } from './outreach-generator.js';

export type OpportunityRunClock = { nowIso(): string };
export const defaultOpportunityRunClock: OpportunityRunClock = { nowIso: () => new Date().toISOString() };
export type OpportunityRunResult = {
  runId: string;
  nicheId: string;
  metrics: import('@umer/contracts').NicheRunMetrics;
  opportunities: import('@umer/contracts').Opportunity[];
  evidence: import('@umer/contracts').EvidenceRecord[];
  events: OpportunityRunEvent[];
  errors: Array<{ stage: string; message: string; candidate?: string }>;
};

export type OpportunityRunServiceOptions = {
  discovery: DiscoveryAdapter;
  research: ResearchAdapter;
  problemDetector: ProblemDetector;
  opportunityBuilder: OpportunityBuilder;
  persistence: OpportunityPersistence;
  outreachGenerator?: OutreachGenerator;
  clock?: OpportunityRunClock;
  onEvent?: (event: OpportunityRunEvent) => Promise<void> | void;
};

export class OpportunityRunService {
  private readonly clock: OpportunityRunClock;
  private readonly outreachGenerator: OutreachGenerator;

  constructor(private readonly options: OpportunityRunServiceOptions) {
    this.clock = options.clock ?? defaultOpportunityRunClock;
    this.outreachGenerator = options.outreachGenerator ?? new DefaultOutreachGenerator();
  }

  async execute(niche: NicheDefinition, runId: string = randomUUID()): Promise<OpportunityRunResult> {
    const startedAt = this.clock.nowIso();
    await this.options.persistence.saveNiche(niche);
    const errors: OpportunityRunResult['errors'] = [];
    const allEvidence: import('@umer/contracts').EvidenceRecord[] = [];
    const opportunities: import('@umer/contracts').Opportunity[] = [];
    const runEvents: OpportunityRunEvent[] = [];

    const emit = async (stage: string, agentName: string, level: OpportunityRunEvent['level'], message: string, metadata?: Record<string, unknown>) => {
      const event: OpportunityRunEvent = {
        id: randomUUID(),
        runId,
        nicheId: niche.id,
        stage,
        agentName,
        level,
        message,
        metadata,
        occurredAt: this.clock.nowIso(),
      };
      runEvents.push(event);
      try {
        await this.options.persistence.saveEvent(event);
      } catch {
        /* ignore persistence failure on non-critical events */
      }
      try {
        await this.options.onEvent?.(event);
      } catch {
        /* ignore event callback error */
      }
    };

    await emit('discovery', 'Orchestrator', 'info', `Starting autonomous run for "${niche.name}" (${runId})`);
    await emit('discovery', 'Discovery Agent', 'info', `Scanning ${niche.geographies.length} target geographies: ${niche.geographies.join(', ')}`);

    let rawCandidates: DiscoveryCandidate[] = [];
    try {
      rawCandidates = await this.options.discovery.discover(niche);
      for (const candidate of rawCandidates) {
        const candidateRecord: DiscoveryCandidateRecord = {
          id: randomUUID(),
          runId,
          nicheId: niche.id,
          externalId: candidate.externalId,
          name: candidate.name,
          websiteUrl: candidate.websiteUrl,
          geography: candidate.geography,
          industry: candidate.industry,
          sourceRefs: candidate.sourceRefs,
          discoveredAt: startedAt,
        };
        await this.options.persistence.saveDiscoveryCandidate(candidateRecord);
      }
      await emit('discovery', 'Discovery Agent', 'info', `Discovered ${rawCandidates.length} raw business candidate listings`);
    } catch (error) {
      const msg = this.message(error);
      errors.push({ stage: 'discovery', message: msg });
      await emit('discovery', 'Discovery Agent', 'error', `Discovery encountered an error: ${msg}`);
    }

    const deduplication = deduplicateCandidates(rawCandidates);
    const candidates = deduplication.unique.slice(0, niche.targetBusinessesPerRun);
    await emit('deduplication', 'Identity Agent', 'info', `Deduplicated candidates into ${candidates.length} unique businesses (${deduplication.duplicatesRemoved} duplicates merged)`);

    let researched = 0;
    let qualified = 0;

    for (const candidate of candidates) {
      try {
        const identity = buildBusinessIdentity({
          externalId: candidate.externalId,
          name: candidate.name,
          websiteUrl: candidate.websiteUrl,
          geography: candidate.geography,
        });

        await emit('research', 'Research Agent', 'info', `Researching business "${candidate.name}" (${candidate.geography})`);
        const evidence = await this.options.research.research(candidate);
        allEvidence.push(...evidence);
        for (const item of evidence) {
          await this.options.persistence.saveEvidence(item);
        }
        researched += 1;

        const business = {
          id: identity.id,
          name: candidate.name,
          ...(identity.canonicalWebsite ? { website: identity.canonicalWebsite } : {}),
          geography: candidate.geography,
          ...(candidate.industry ? { industry: candidate.industry } : {}),
          nicheId: niche.id,
          sourceRefs: [...new Set(candidate.sourceRefs)],
          discoveredAt: startedAt,
          lastResearchedAt: this.clock.nowIso(),
        } satisfies import('@umer/contracts').BusinessProspect;
        await this.options.persistence.saveBusiness(business);

        const researchCase: ResearchCase = {
          id: this.researchCaseId(niche, identity.id),
          objective: `Assess ${candidate.name} for commercially actionable problems in ${niche.name}.`,
          nicheId: niche.id,
          businessId: identity.id,
          depth: niche.researchDepth,
          questions: niche.problemHypotheses.length > 0 ? [...niche.problemHypotheses] : ['What operational or digital problems are evidenced?', 'What evidence supports a paid solution?'],
          evidenceRefs: evidence.map((item) => item.id),
          status: 'completed',
          startedAt,
          completedAt: this.clock.nowIso(),
        };
        await this.options.persistence.saveResearchCase(researchCase);

        await emit('audit', 'Audit Agent', 'info', `Evaluating commercial signals and evidence for "${candidate.name}"`);
        const problems = await this.options.problemDetector.detect(candidate, evidence);
        if (problems.length > 0) {
          qualified += 1;
          for (const prob of problems) {
            await this.options.persistence.saveProblem(prob, {
              businessId: identity.id,
              nicheId: niche.id,
              runId,
            });
          }
          await emit('problems', 'Analysis Agent', 'info', `Identified ${problems.length} evidence-backed commercial problems for "${candidate.name}"`);
        }

        const built = await this.options.opportunityBuilder.build({ niche, candidate, evidence, problems });
        for (const opportunity of built) {
          await this.options.persistence.saveOpportunity(opportunity);
          opportunities.push(opportunity);
          await emit('scoring', 'Opportunity Agent', 'info', `Built and scored opportunity: "${opportunity.title}" (Score: ${opportunity.score.overall}/100 [${opportunity.score.recommendation}])`);

          if (opportunity.score.recommendation === 'outreach_ready' || opportunity.score.overall >= niche.minimumOpportunityScore) {
            const drafts = await this.outreachGenerator.generateDrafts({
              opportunity,
              business,
              problems,
              evidence,
              niche,
            });
            for (const draft of drafts) {
              await this.options.persistence.saveOutreachDraft(draft);
            }
            await emit('outreach', 'Outreach Agent', 'info', `Drafted ${drafts.length} personalized proposals (WhatsApp & Email) for "${candidate.name}"`);
          }
        }
      } catch (error) {
        const msg = this.message(error);
        errors.push({ stage: 'candidate', message: msg, candidate: candidate.name });
        await emit('research', 'Research Agent', 'warn', `Failed researching candidate "${candidate.name}": ${msg}`);
      }
    }

    const highValue = opportunities.filter((item) => item.score.overall >= niche.minimumOpportunityScore);
    const estimatedPipeline = highValue.reduce((sum, item) => sum + (item.estimatedValueMax ?? item.estimatedValueMin ?? 0), 0);

    const metrics: import('@umer/contracts').NicheRunMetrics = {
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

    await emit(
      'completed',
      'Orchestrator',
      'success',
      `Autonomous run completed: ${opportunities.length} opportunities created (${highValue.length} high-value, $${estimatedPipeline.toLocaleString()} USD est. pipeline)`,
      { metrics },
    );

    return { runId, nicheId: niche.id, metrics, opportunities, evidence: allEvidence, events: runEvents, errors };
  }

  private researchCaseId(niche: NicheDefinition, businessId: string): string {
    return `research_${createHash('sha256').update(`${niche.id}|${businessId}`).digest('hex')}`;
  }

  private message(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}

