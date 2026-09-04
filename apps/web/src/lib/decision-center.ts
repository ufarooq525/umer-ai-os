/**
 * Pure derivations for the CEO Decision Center (/decisions). This page is
 * the itemized triage view that Attention's aggregated "decision_required"
 * case (company-derive.ts) links out to — same real threshold, reused here
 * rather than redefined, just not collapsed into one badge count.
 */

import { DECIDABLE_OPPORTUNITY_STATUSES, HIGH_PRIORITY_SCORE_THRESHOLD, PROMISING_SCORE_THRESHOLD } from './company-derive';
import type { OpportunityRecord } from './control-api';

export type DecisionTier = 'important' | 'review';

export function deriveDecisionTier(score: number): DecisionTier {
  return score >= HIGH_PRIORITY_SCORE_THRESHOLD ? 'important' : 'review';
}

/** Real opportunities the CEO can act on right now — decidable status, cleared the same score bar Attention uses — sorted highest score first. */
export function deriveDecisionQueue(opportunities: OpportunityRecord[]): OpportunityRecord[] {
  return opportunities
    .filter((o) => (o.score?.overall ?? 0) >= PROMISING_SCORE_THRESHOLD && DECIDABLE_OPPORTUNITY_STATUSES.has(o.status))
    .sort((a, b) => (b.score?.overall ?? 0) - (a.score?.overall ?? 0));
}

/**
 * What actually happens next per the real command semantics
 * (SelectOpportunity -> 'selected_for_execution' -> CreateProjectFromOpportunity
 * becomes available; RejectOpportunity -> 'rejected' -> leaves the decidable
 * set for good) — describes real system behavior, not a per-opportunity guess.
 */
export const DECISION_CONSEQUENCE = {
  ifApproved: [
    'Opportunity moves to "selected for execution."',
    'A validation project can then be created from it in this same console.',
    'Prospect and task work can be assigned once that project exists.',
  ],
  ifRejected: ['Opportunity leaves the active decision queue.', 'No project or further work will be created from it.'],
} as const;
