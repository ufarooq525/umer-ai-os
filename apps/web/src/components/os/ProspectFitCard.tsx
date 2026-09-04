import { Card, colors, fonts } from '@umer/ui';
import type { OutreachReadiness, ProspectFit } from '@/lib/commercial-intelligence';

const READINESS_META: Record<OutreachReadiness['status'], { icon: string; label: string; color: string }> = {
  ready: { icon: '🟢', label: 'Ready for outreach preparation', color: colors.success },
  incomplete: { icon: '🟡', label: 'Prospect research incomplete', color: colors.warning },
  blocked: { icon: '🔴', label: 'Data quality issue', color: colors.danger },
};

export function ProspectFitCard({ fit, readiness }: { fit: ProspectFit; readiness: OutreachReadiness }) {
  const meta = READINESS_META[readiness.status];
  return (
    <Card title="Why This Prospect?">
      <div style={{ marginBottom: 12 }}>
        {fit.score != null ? (
          <div style={{ fontFamily: fonts.mono, fontSize: 28, fontWeight: 700, color: colors.accent }}>
            {fit.score}
            <span style={{ fontSize: 13, color: colors.muted }}>/100 fit</span>
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: colors.muted }}>No scored opportunity for this business yet.</p>
        )}
        {fit.reasons.length > 0 ? (
          <div style={{ display: 'grid', gap: 4, marginTop: 8 }}>
            {fit.reasons.map((r) => (
              <div key={r} style={{ fontSize: 12, color: colors.text }}>
                ✓ {r}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          paddingTop: 10,
          marginBottom: 8,
          borderTop: `1px solid ${colors.border}`,
        }}
      >
        <span aria-hidden>{meta.icon}</span>
        <strong style={{ fontSize: 13, color: meta.color }}>{meta.label}</strong>
      </div>
      <div style={{ display: 'grid', gap: 4 }}>
        {readiness.reasons.map((r) => (
          <div key={r} style={{ fontSize: 12, color: colors.muted }}>
            ✓ {r}
          </div>
        ))}
        {readiness.blockers.map((b) => (
          <div key={b} style={{ fontSize: 12, color: colors.warning }}>
            ⚠ {b}
          </div>
        ))}
      </div>
    </Card>
  );
}
