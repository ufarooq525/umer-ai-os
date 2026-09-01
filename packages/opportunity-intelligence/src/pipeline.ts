import type {
  EvidenceRecord,
  NicheDefinition,
  Opportunity,
  Problem,
} from '@umer/contracts';

export type DiscoveryCandidate = {
  externalId?: string;
  name: string;
  geography: string;
  industry?: string;
  websiteUrl?: string;
  sourceRefs: string[];
};

export type { EvidenceRecord };

export type BusinessAudit = {
  businessId: string;
  digitalPresence: {
    website: number;
    conversion: number;
    booking: number;
    payments: number;
    automation: number;
    integrations: number;
    trust: number;
  };
  operationalSignals: string[];
  evidenceRefs: string[];
};

export type DiscoveryAdapter = {
  discover(niche: NicheDefinition): Promise<DiscoveryCandidate[]>;
};

export type ResearchAdapter = {
  research(candidate: DiscoveryCandidate): Promise<EvidenceRecord[]>;
};

export type ProblemDetector = {
  detect(candidate: DiscoveryCandidate, evidence: EvidenceRecord[]): Promise<Problem[]>;
};

export type OpportunityBuilder = {
  build(input: {
    niche: NicheDefinition;
    candidate: DiscoveryCandidate;
    evidence: EvidenceRecord[];
    problems: Problem[];
  }): Promise<Opportunity[]>;
};

export type PipelineResult = {
  nicheId: string;
  runId: string;
  discovered: number;
  researched: number;
  opportunities: Opportunity[];
  evidence: EvidenceRecord[];
  errors: Array<{ stage: string; message: string; candidate?: string }>;
};

export type OpportunityPipeline = {
  run(niche: NicheDefinition, runId: string): Promise<PipelineResult>;
};

export class DefaultOpportunityPipeline implements OpportunityPipeline {
  constructor(
    private readonly discovery: DiscoveryAdapter,
    private readonly research: ResearchAdapter,
    private readonly problemDetector: ProblemDetector,
    private readonly opportunityBuilder: OpportunityBuilder,
  ) {}

  async run(niche: NicheDefinition, runId: string): Promise<PipelineResult> {
    const errors: PipelineResult['errors'] = [];
    const opportunities: Opportunity[] = [];
    const allEvidence: EvidenceRecord[] = [];

    let candidates: DiscoveryCandidate[] = [];
    try {
      candidates = await this.discovery.discover(niche);
    } catch (error) {
      errors.push({ stage: 'discovery', message: this.message(error) });
      return { nicheId: niche.id, runId, discovered: 0, researched: 0, opportunities, evidence: allEvidence, errors };
    }

    const limited = candidates.slice(0, niche.targetBusinessesPerRun);
    let researched = 0;
    for (const candidate of limited) {
      try {
        const evidence = await this.research.research(candidate);
        allEvidence.push(...evidence);
        researched += 1;
        const problems = await this.problemDetector.detect(candidate, evidence);
        opportunities.push(...await this.opportunityBuilder.build({ niche, candidate, evidence, problems }));
      } catch (error) {
        errors.push({ stage: 'research', message: this.message(error), candidate: candidate.name });
      }
    }

    return { nicheId: niche.id, runId, discovered: candidates.length, researched, opportunities, evidence: allEvidence, errors };
  }

  private message(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
