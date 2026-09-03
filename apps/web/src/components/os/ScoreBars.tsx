import { colors, fonts } from '@umer/ui';
import type { OpportunityScore } from '@/lib/control-api';

const LABELS: Array<[keyof OpportunityScore, string]> = [
  ['problemSeverity', 'Problem severity'],
  ['demandEvidence', 'Demand evidence'],
  ['abilityToPay', 'Ability to pay'],
  ['reachability', 'Reachability'],
  ['solutionFit', 'Solution fit'],
  ['competitiveGap', 'Competitive gap'],
  ['deliveryFeasibility', 'Delivery feasibility'],
  ['evidenceConfidence', 'Evidence confidence'],
];

export function ScoreBars({ score }: { score: OpportunityScore }) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {LABELS.map(([key, label]) => {
        const value = score[key] as number;
        return (
          <div key={key} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 32px', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: colors.muted }}>{label}</span>
            <div style={{ height: 6, borderRadius: 999, background: colors.surfaceRaised, overflow: 'hidden' }}>
              <div style={{ width: `${value}%`, height: '100%', background: colors.accent }} />
            </div>
            <span style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.muted, textAlign: 'right' }}>{value}</span>
          </div>
        );
      })}
    </div>
  );
}
