import { describe, expect, it } from 'vitest';
import { deriveDecisionQueue, deriveDecisionTier } from './decision-center';
import type { OpportunityRecord } from './control-api';

const opportunity = (over: Partial<OpportunityRecord> = {}): OpportunityRecord => ({
  id: 'opp-1',
  type: 'repeatable_service',
  title: 'Opportunity',
  geography: 'Makkah',
  market: 'Saudi Umrah',
  status: 'validated',
  score: {
    problemSeverity: 70,
    demandEvidence: 70,
    abilityToPay: 70,
    reachability: 70,
    solutionFit: 70,
    competitiveGap: 70,
    deliveryFeasibility: 70,
    evidenceConfidence: 70,
    overall: 75,
    recommendation: 'outreach_ready',
  },
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  ...over,
});

describe('deriveDecisionTier', () => {
  it('tags high-priority-threshold scores as important', () => {
    expect(deriveDecisionTier(91)).toBe('important');
    expect(deriveDecisionTier(85)).toBe('important');
  });

  it('tags everything else in the decidable range as review', () => {
    expect(deriveDecisionTier(84)).toBe('review');
    expect(deriveDecisionTier(70)).toBe('review');
  });
});

describe('deriveDecisionQueue', () => {
  it('includes only decidable-status opportunities that cleared the real score threshold, sorted highest first', () => {
    const queue = deriveDecisionQueue([
      opportunity({ id: 'low-score', status: 'validated', score: { ...opportunity().score!, overall: 40 } }),
      opportunity({ id: 'terminal', status: 'rejected', score: { ...opportunity().score!, overall: 90 } }),
      opportunity({ id: 'top', status: 'outreach_ready', score: { ...opportunity().score!, overall: 91 } }),
      opportunity({ id: 'mid', status: 'researching', score: { ...opportunity().score!, overall: 78 } }),
    ]);
    expect(queue.map((o) => o.id)).toEqual(['top', 'mid']);
  });

  it('never itemizes an opportunity that has no score at all', () => {
    const queue = deriveDecisionQueue([opportunity({ score: undefined })]);
    expect(queue).toHaveLength(0);
  });

  it('returns an empty queue honestly when nothing is decidable, never a fabricated placeholder', () => {
    expect(deriveDecisionQueue([])).toEqual([]);
  });
});
