import { describe, expect, it } from 'vitest';
import { buildOpportunityDossier } from './dossier.js';
import type { EvidenceRecord, Opportunity, Problem } from '@umer/contracts';

const evidence: EvidenceRecord[] = [
  {
    id: 'ev-1',
    type: 'website',
    title: 'Booking workflow',
    sourceUrl: 'https://example.com',
    observedAt: '2026-09-02T00:00:00.000Z',
    observation: 'Customers are asked to request a quote manually.',
    strength: 'strong',
    supports: ['problem-1', 'opp-1'],
    contradicts: [],
  },
];

const problem: Problem = {
  id: 'problem-1',
  statement: 'Manual quoting creates sales friction.',
  severity: 80,
  frequency: 70,
  financialImpact: 75,
  evidenceConfidence: 85,
  evidenceRefs: ['ev-1'],
};

const opportunity: Opportunity = {
  id: 'opp-1',
  type: 'service',
  title: 'Quote and booking workflow',
  geography: 'Saudi Arabia',
  market: 'Umrah transport',
  nicheId: 'saudi-umrah-transport',
  businessId: 'business-1',
  problemIds: ['problem-1'],
  score: {
    problemSeverity: 80,
    demandEvidence: 75,
    abilityToPay: 70,
    reachability: 80,
    solutionFit: 90,
    competitiveGap: 65,
    deliveryFeasibility: 85,
    evidenceConfidence: 85,
    overall: 78,
    recommendation: 'outreach_ready',
  },
  evidenceRefs: ['ev-1'],
  status: 'outreach_ready',
  createdAt: '2026-09-02T00:00:00.000Z',
  updatedAt: '2026-09-02T00:00:00.000Z',
};

describe('buildOpportunityDossier', () => {
  it('includes only evidence explicitly linked to the opportunity', () => {
    const result = buildOpportunityDossier({ opportunity, problems: [problem], evidence });

    expect(result.evidence).toHaveLength(1);
    expect(result.markdown).toContain('Manual quoting creates sales friction.');
    expect(result.markdown).toContain('https://example.com');
    expect(result.markdown).toContain('78/100');
  });
});
