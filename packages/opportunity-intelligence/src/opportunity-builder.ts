import type { NicheDefinition, Opportunity, Problem } from '@umer/contracts';
import { createHash } from 'node:crypto';
import { scoreOpportunity } from './scoring.js';
import { buildBusinessIdentity } from './identity.js';
import type { DiscoveryCandidate, OpportunityBuilder } from './pipeline.js';

function id(input: string): string { return createHash('sha256').update(input).digest('hex'); }

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
    const businessId = buildBusinessIdentity({
      externalId: candidate.externalId,
      name: candidate.name,
      websiteUrl: candidate.websiteUrl,
      geography: candidate.geography,
    }).id;
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

      const opportunityId = id(`${niche.id}|${businessId}|${problem.id}`);
      const title = this.formatSolutionTitle(candidate.name, problem.statement);
      const { minVal, maxVal, days } = this.estimateValuation(problem);

      opportunities.push({
        id: opportunityId,
        type: 'repeatable_service',
        title,
        geography: candidate.geography,
        market: niche.name,
        nicheId: niche.id,
        businessId,
        problemIds: [problem.id],
        score,
        estimatedValueMin: minVal,
        estimatedValueMax: maxVal,
        currency: 'USD',
        timeToRevenueDays: days,
        evidenceRefs: evidence.map((item) => item.id),
        status: score.recommendation === 'outreach_ready' ? 'outreach_ready' : 'validated',
        createdAt: now,
        updatedAt: now,
      });
    }
    return opportunities;
  }

  private formatSolutionTitle(businessName: string, problemStatement: string): string {
    const lower = problemStatement.toLowerCase();
    if (lower.includes('booking')) {
      return `${businessName}: Automated Self-Service Booking & Reservation System`;
    }
    if (lower.includes('payment') || lower.includes('checkout')) {
      return `${businessName}: Direct Digital Checkout & Payment Gateway Integration`;
    }
    if (lower.includes('conversion') || lower.includes('lead capture')) {
      return `${businessName}: Automated Lead Capture & Conversion Engine`;
    }
    if (lower.includes('storefront') || lower.includes('without a public digital')) {
      return `${businessName}: Digital Storefront & Online Discovery Portal`;
    }
    if (lower.includes('crm') || lower.includes('automation')) {
      return `${businessName}: Automated Customer Follow-up & CRM Workflow System`;
    }
    return `${businessName}: Solution for ${problemStatement.toLowerCase()}`;
  }

  private estimateValuation(problem: Problem): { minVal: number; maxVal: number; days: number } {
    const severityFactor = (problem.severity * problem.financialImpact) / 10000;
    const baseMin = Math.round(1500 + severityFactor * 3500);
    const baseMax = Math.round(baseMin * 2.5);
    const days = Math.max(14, Math.round(45 - severityFactor * 15));
    return { minVal: baseMin, maxVal: baseMax, days };
  }
}
