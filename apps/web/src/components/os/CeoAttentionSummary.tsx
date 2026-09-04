import Link from 'next/link';
import { Card, colors, fonts } from '@umer/ui';
import type { AttentionCase, AttentionSeverity } from '@/lib/company-derive';

const SEVERITY_META: Record<AttentionSeverity, { icon: string; label: string; color: string }> = {
  critical: { icon: '🔴', label: 'Critical', color: colors.danger },
  high: { icon: '🟠', label: 'High', color: colors.warning },
  medium: { icon: '🟡', label: 'Decision required', color: colors.warning },
  low: { icon: '🔵', label: 'Low', color: colors.muted },
};

export function CeoAttentionSummary({ cases, href = '/attention' }: { cases: AttentionCase[]; href?: string }) {
  const counts = cases.reduce<Record<AttentionSeverity, number>>(
    (acc, c) => ({ ...acc, [c.severity]: (acc[c.severity] ?? 0) + 1 }),
    { critical: 0, high: 0, medium: 0, low: 0 },
  );

  return (
    <Card title="CEO Attention">
      {cases.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: colors.muted }}>
          Nothing needs your awareness right now. Everything is operating normally.
        </p>
      ) : (
        <>
          <p style={{ margin: '0 0 10px', fontSize: 14 }}>
            <strong>{cases.length}</strong> item{cases.length === 1 ? '' : 's'} require your awareness
          </p>
          <div style={{ display: 'grid', gap: 4, marginBottom: 10 }}>
            {(['critical', 'high', 'medium', 'low'] as const)
              .filter((sev) => counts[sev] > 0)
              .map((sev) => (
                <div key={sev} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontFamily: fonts.mono }}>
                  <span aria-hidden>{SEVERITY_META[sev].icon}</span>
                  <span style={{ color: SEVERITY_META[sev].color, fontWeight: 700 }}>{counts[sev]}</span>
                  <span style={{ color: colors.muted }}>{SEVERITY_META[sev].label}</span>
                </div>
              ))}
          </div>
          <p style={{ margin: '0 0 12px', fontSize: 12, color: colors.muted }}>Everything else is operating normally.</p>
        </>
      )}
      <Link href={href} style={{ fontSize: 12, color: colors.accent, textDecoration: 'none' }}>
        Review Attention →
      </Link>
    </Card>
  );
}
