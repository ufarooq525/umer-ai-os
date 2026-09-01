import type { NicheDefinition, Opportunity, Problem } from '@umer/contracts';
import { createHash } from 'node:crypto';
import { scoreOpportunity } from './scoring.js';
import type { DiscoveryCandidate, OpportunityBuilder } from './pipeline.js';

function id(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function evidenceConfidence(problems: Problem[]): number {
  if (problems.length === 0) return 0;
  return Math.round(problems.reduce((sum, problem) => sum + problem.evidenceConfidence, 0) / problems.length);
}

export class DefaultOpportunityBuilder implements OpportunityBuilder {
  async build(input: {
    niche: NicheDefinition;
    candidate: DiscoveryCandidate;
    evidence: import('@umer/contracts').EvidenceRecord[];
    problems: Problem[];
  }): Promise<Opportunity[]> {
    const { niche, candidate, evidence, problems } = input;
    if (problems.length === 0 || evidence.length === 0) return [];

    const confidence = evidenceConfidence(problems);
    const opportunities: Opportunity[] = [];
    const now = new Date().toISOString();

    for (const problem of problems) {
      const reachability = candidate.websiteUrl ? 85 : 60;
      const solutionFit = niche.allowedSolutionTypes.length > 0 ? 80 : 60;
      const demandEvidence = Math.min(100, Math.round((problem.frequency + confidence) / 2));
      const score = scoreOpportunity({
        problemSeverity: problem.severity,
        demandEvidence,
        abilityToPay: problem.financialImpact,
        reachability,
        solutionFit,
        competitiveGap: 60,
        deliveryFeasibility: 75,
        evidenceConfidence: confidence,
      });

      if (score.overall < niche.minimumOpportunityScore) continue;

      const opportunityId = id(`${niche.id}|${candidate.externalId ?? candidate.name}|${problem.id}`);
      opportunities.push({
        id: opportunityId,
        type: 'repeatable_service',
        title: `${candidate.name}: solve ${problem.statement.toLowerCase()}`,
        geography: candidate.geography,
        market: niche.name,
        nicheId: niche.id,
        ...(candidate.externalId ? { businessId: candidate.externalId } : {}),
        problemIds: [problem.id],
        score,
        estimatedValueMin: 500,
        estimatedValueMax: 5000,
        currency: 'USD',
        timeToRevenueDays: 30,
        evidenceRefs: evidence.map((item) => item.id),
        status: score.recommendation === 'outreach_ready' ? 'outreach_ready' : 'validated',
        createdAt: now,
        updatedAt: now,
      });
    }

    return opportunities;
  }
}
