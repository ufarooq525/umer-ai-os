import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SCORE_WEIGHTS,
  scoreOpportunity,
  type ScoreFactors,
} from './scoring.js';

const strong: ScoreFactors = {
  problemSeverity: 90,
  demandEvidence: 90,
  abilityToPay: 85,
  reachability: 80,
  solutionFit: 90,
  competitiveGap: 75,
  deliveryFeasibility: 90,
  evidenceConfidence: 90,
};

describe('scoreOpportunity', () => {
  it('produces an outreach-ready score for strong evidence', () => {
    const result = scoreOpportunity(strong);

    expect(result.overall).toBe(87);
    expect(result.recommendation).toBe('outreach_ready');
  });

  it('blocks outreach when evidence confidence is too low', () => {
    const result = scoreOpportunity({ ...strong, evidenceConfidence: 40 });

    expect(result.overall).toBe(85);
    expect(result.recommendation).toBe('research_more');
  });

  it('rejects weak economics', () => {
    const result = scoreOpportunity({
      problemSeverity: 20,
      demandEvidence: 20,
      abilityToPay: 20,
      reachability: 20,
      solutionFit: 20,
      competitiveGap: 20,
      deliveryFeasibility: 20,
      evidenceConfidence: 90,
    });

    expect(result.overall).toBe(24);
    expect(result.recommendation).toBe('reject');
  });

  it('rejects invalid weight sets', () => {
    expect(() =>
      scoreOpportunity(strong, { ...DEFAULT_SCORE_WEIGHTS, problemSeverity: 0.5 }),
    ).toThrow(/sum to 1/);
  });
});
