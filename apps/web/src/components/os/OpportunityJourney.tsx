import { colors, fonts } from '@umer/ui';

export const OPPORTUNITY_STAGES = ['Discovered', 'Evaluating', 'Selected', 'Project', 'Outcome'] as const;
const STAGES = OPPORTUNITY_STAGES;

const STATUS_TO_STAGE_INDEX: Record<string, number> = {
  discovered: 0,
  researching: 1,
  validated: 1,
  outreach_ready: 1,
  in_sales: 1,
  selected_for_execution: 2,
  project_created: 3,
  won: 4,
  lost: 4,
  rejected: 4,
  converted_to_product: 4,
};

export function opportunityStageIndex(status: string): number {
  return STATUS_TO_STAGE_INDEX[status] ?? 0;
}

const RECOMMENDATION_LABELS: Record<string, string> = {
  reject: 'Not worth pursuing based on current evidence.',
  watch: 'Worth monitoring, not yet strong enough to act on.',
  research_more: 'Needs more research before a decision can be made.',
  outreach_ready: 'Ready to reach out to prospects and validate willingness to pay.',
  product_candidate: 'Strong enough to justify building a product for it.',
};

export function recommendationLabel(recommendation: string): string {
  return RECOMMENDATION_LABELS[recommendation] ?? recommendation;
}

export function OpportunityJourney({ status }: { status: string }) {
  const current = opportunityStageIndex(status);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {STAGES.map((stage, idx) => (
        <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span
            style={{
              fontFamily: fonts.mono,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.04em',
              padding: '3px 8px',
              borderRadius: 999,
              border: `1px solid ${idx === current ? colors.accent : colors.border}`,
              background: idx === current ? colors.accentSoft : idx < current ? colors.surfaceRaised : 'transparent',
              color: idx <= current ? colors.text : colors.muted,
            }}
          >
            {stage.toUpperCase()}
          </span>
          {idx < STAGES.length - 1 ? <span style={{ color: colors.border }}>→</span> : null}
        </div>
      ))}
    </div>
  );
}
