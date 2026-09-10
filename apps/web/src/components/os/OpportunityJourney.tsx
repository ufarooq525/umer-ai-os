import { colors, fonts } from '@umer/ui';

export const OPPORTUNITY_8_STAGES = [
  { id: 'discovery', label: 'Discovery' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'prospect', label: 'Prospect' },
  { id: 'contact', label: 'Contact' },
  { id: 'outreach', label: 'Outreach' },
  { id: 'qualification', label: 'Qualification' },
  { id: 'proposal', label: 'Proposal' },
  { id: 'outcome', label: 'Won / Lost' },
] as const;

export const OPPORTUNITY_STAGES = ['Discovered', 'Evaluating', 'Selected', 'Project', 'Outcome'] as const;

const STATUS_TO_8_STAGE_INDEX: Record<string, number> = {
  discovered: 0,
  researching: 1,
  validated: 2,
  outreach_ready: 3,
  in_sales: 4,
  selected_for_execution: 5,
  project_created: 6,
  won: 7,
  lost: 7,
  rejected: 7,
  converted_to_product: 7,
};

export function opportunity8StageIndex(status: string): number {
  return STATUS_TO_8_STAGE_INDEX[status.toLowerCase()] ?? 0;
}

export function opportunityStageIndex(status: string): number {
  const map: Record<string, number> = {
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
  return map[status.toLowerCase()] ?? 0;
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
  const currentIdx = opportunity8StageIndex(status);
  const isWon = status.toLowerCase() === 'won' || status.toLowerCase() === 'converted_to_product';
  const isLost = status.toLowerCase() === 'lost' || status.toLowerCase() === 'rejected';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        overflowX: 'auto',
        padding: '12px 14px',
        background: 'rgba(255, 255, 255, 0.02)',
        borderRadius: 10,
        border: `1px solid ${colors.border}`,
      }}
    >
      {OPPORTUNITY_8_STAGES.map((st, idx) => {
        const isPast = idx < currentIdx;
        const isCurrent = idx === currentIdx;

        let bg: string = 'transparent';
        let border: string = colors.border;
        let textCol: string = colors.muted;

        if (isCurrent) {
          if (idx === 7 && isLost) {
            bg = 'rgba(239, 68, 68, 0.15)';
            border = colors.danger;
            textCol = colors.danger;
          } else if (idx === 7 && isWon) {
            bg = 'rgba(34, 197, 94, 0.15)';
            border = colors.success;
            textCol = colors.success;
          } else {
            bg = colors.accentSoft;
            border = colors.accent;
            textCol = colors.text;
          }
        } else if (isPast) {
          bg = 'rgba(255, 255, 255, 0.05)';
          border = 'rgba(255, 255, 255, 0.12)';
          textCol = colors.text;
        }


        return (
          <div key={st.id} style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 6,
                background: bg,
                border: `1px solid ${border}`,
                transition: 'all 0.15s ease',
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: isCurrent ? colors.accent : isPast ? colors.success : colors.border,
                }}
              />
              <span
                style={{
                  fontFamily: fonts.mono,
                  fontSize: 11,
                  fontWeight: isCurrent ? 700 : 500,
                  letterSpacing: '0.03em',
                  color: textCol,
                }}
              >
                {st.label}
              </span>
              {isPast && (
                <span style={{ fontSize: 10, color: colors.success }}>✓</span>
              )}
            </div>
            {idx < OPPORTUNITY_8_STAGES.length - 1 && (
              <span style={{ color: isPast ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.1)', fontSize: 12 }}>→</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

