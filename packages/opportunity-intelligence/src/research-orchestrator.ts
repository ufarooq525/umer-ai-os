import { createHash } from 'node:crypto';
import type { EvidenceRecord, NicheDefinition, ResearchCase } from '@umer/contracts';
import { buildBusinessIdentity } from './identity.js';
import type { DiscoveryCandidate, ResearchAdapter } from './pipeline.js';
import type { OpportunityPersistence } from './persistence.js';

export type ResearchOrchestratorOptions = {
  research: ResearchAdapter;
  persistence: OpportunityPersistence;
  now?: () => string;
};

export type ResearchResult = {
  researchCase: ResearchCase;
  evidence: EvidenceRecord[];
  error?: string;
};

/**
 * Turns one discovered business into a traceable research case. Evidence is
 * persisted before the case is marked completed, keeping the evidence trail
 * durable and auditable.
 */
export class ResearchOrchestrator {
  constructor(private readonly options: ResearchOrchestratorOptions) {}

  async run(niche: NicheDefinition, candidate: DiscoveryCandidate): Promise<ResearchResult> {
    const now = this.options.now ?? (() => new Date().toISOString());
    const startedAt = now();
    const businessId = buildBusinessIdentity({
      externalId: candidate.externalId,
      name: candidate.name,
      websiteUrl: candidate.websiteUrl,
      geography: candidate.geography,
    }).id;
    const caseId = this.caseId(niche.id, businessId, startedAt);
    const researchCase: ResearchCase = {
      id: caseId,
      objective: `Assess ${candidate.name} for commercially relevant problems and opportunities`,
      nicheId: niche.id,
      businessId,
      depth: niche.researchDepth,
      questions: [
        'What evidence indicates operational, digital, or commercial problems?',
        'Which problems appear painful enough to have economic value?',
        'What solution or revenue opportunity is supported by the evidence?',
      ],
      evidenceRefs: [],
      status: 'running',
      startedAt,
    };
    await this.options.persistence.saveResearchCase(researchCase);

    try {
      const evidence = await this.options.research.research(candidate);
      for (const item of evidence) {
        await this.options.persistence.saveEvidence(item);
      }
      const completedAt = now();
      const completed: ResearchCase = {
        ...researchCase,
        evidenceRefs: evidence.map((item) => item.id),
        status: 'completed',
        completedAt,
      };
      await this.options.persistence.saveResearchCase(completed);
      return { researchCase: completed, evidence };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const blocked: ResearchCase = {
        ...researchCase,
        status: 'blocked',
        completedAt: now(),
      };
      await this.options.persistence.saveResearchCase(blocked);
      return { researchCase: blocked, evidence: [], error: message };
    }
  }

  private caseId(nicheId: string, businessId: string, startedAt: string): string {
    return createHash('sha256')
      .update(`research-case:${nicheId}:${businessId}:${startedAt}`)
      .digest('hex');
  }
}
