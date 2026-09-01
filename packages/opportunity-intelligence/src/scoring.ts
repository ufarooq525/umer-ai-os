import type { OpportunityScore } from '@umer/contracts';

export type ScoreFactors = Omit<OpportunityScore, 'overall' | 'recommendation'>;

export type ScoreWeights = {
  problemSeverity: number;
  demandEvidence: number;
  abilityToPay: number;
  reachability: number;
  solutionFit: number;
  competitiveGap: number;
  deliveryFeasibility: number;
  evidenceConfidence: number;
};

export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {
  problemSeverity: 0.20,
  demandEvidence: 0.15,
  abilityToPay: 0.15,
  reachability: 0.15,
  solutionFit: 0.15,
  competitiveGap: 0.10,
  deliveryFeasibility: 0.05,
  evidenceConfidence: 0.05,
};

export type RecommendationThresholds = {
  rejectBelow: number;
  watchBelow: number;
  researchMoreBelow: number;
  outreachReadyAt: number;
  minimumEvidenceConfidence: number;
};

export const DEFAULT_RECOMMENDATION_THRESHOLDS: RecommendationThresholds = {
  rejectBelow: 40,
  watchBelow: 55,
  researchMoreBelow: 70,
  outreachReadyAt: 70,
  minimumEvidenceConfidence: 60,
};

function assertWeights(weights: ScoreWeights): void {
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  if (Math.abs(total - 1) > 0.000001) {
    throw new Error(`Opportunity score weights must sum to 1; received ${total}`);
  }
}

export function scoreOpportunity(
  factors: ScoreFactors,
  weights: ScoreWeights = DEFAULT_SCORE_WEIGHTS,
  thresholds: RecommendationThresholds = DEFAULT_RECOMMENDATION_THRESHOLDS,
): OpportunityScore {
  assertWeights(weights);

  const overall = Math.round(
    Object.entries(weights).reduce(
      (sum, [key, weight]) => sum + factors[key as keyof ScoreFactors] * weight,
      0,
    ),
  );

  let recommendation: OpportunityScore['recommendation'];
  if (overall < thresholds.rejectBelow) {
    recommendation = 'reject';
  } else if (overall < thresholds.watchBelow) {
    recommendation = 'watch';
  } else if (
    overall < thresholds.outreachReadyAt ||
    factors.evidenceConfidence < thresholds.minimumEvidenceConfidence
  ) {
    recommendation = 'research_more';
  } else {
    recommendation = 'outreach_ready';
  }

  return { ...factors, overall, recommendation };
}
