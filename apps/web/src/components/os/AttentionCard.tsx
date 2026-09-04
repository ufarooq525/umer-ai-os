import { colors, fonts, radii, spacing } from '@umer/ui';
import type { AttentionCase, AttentionSeverity } from '@/lib/company-derive';

const SEVERITY_META: Record<AttentionSeverity, { icon: string; label: string; color: string }> = {
  critical: { icon: '🔴', label: 'CRITICAL', color: colors.danger },
  high: { icon: '🟠', label: 'HIGH', color: colors.warning },
  medium: { icon: '🟡', label: 'MEDIUM', color: colors.warning },
  low: { icon: '🔵', label: 'LOW', color: colors.muted },
};

const CATEGORY_LABEL: Record<AttentionCase['category'], string> = {
  repeated_failure: 'REPEATED FAILURE',
  decision_required: 'DECISION REQUIRED',
  waiting_too_long: 'WAITING TOO LONG',
  contact_intelligence_incomplete: 'CONTACT INTELLIGENCE INCOMPLETE',
  outreach_ready: 'OUTREACH READY',
};

export function AttentionCard({
  attentionCase,
  active,
  onSelect,
}: {
  attentionCase: AttentionCase;
  active?: boolean;
  onSelect?: () => void;
}) {
  const meta = SEVERITY_META[attentionCase.severity];
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: spacing.md,
        borderRadius: radii.lg,
        border: `1px solid ${active ? meta.color : `${meta.color}44`}`,
        background: active ? colors.surfaceRaised : colors.surface,
        color: colors.text,
        cursor: onSelect ? 'pointer' : 'default',
        font: 'inherit',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontFamily: fonts.mono,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.08em',
          color: meta.color,
          marginBottom: 6,
        }}
      >
        <span aria-hidden>{meta.icon}</span>
        {meta.label} · {CATEGORY_LABEL[attentionCase.category]}
      </div>
      <strong style={{ fontSize: 14 }}>{attentionCase.title}</strong>
      <p style={{ margin: '4px 0 0', fontSize: 12, color: colors.muted, lineHeight: 1.4 }}>{attentionCase.severityReason}</p>
    </button>
  );
}
