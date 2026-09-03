import { Card, colors, fonts } from '@umer/ui';
import { getRecentAudit } from '@/lib/control-api';
import { TechnicalDetailsDrawer } from '@/components/os/TechnicalDetailsDrawer';
import { formatRelativeTime } from '@/components/os/format';

export const dynamic = 'force-dynamic';

export default async function EventsPage() {
  const records = await getRecentAudit();
  const sorted = [...records].sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <header>
        <h1 style={{ fontSize: 'clamp(1.5rem, 2.6vw, 2rem)', fontWeight: 650, margin: 0, letterSpacing: '-0.03em' }}>
          Events
        </h1>
        <p style={{ margin: '8px 0 0', color: colors.muted, fontSize: 14, maxWidth: 640, lineHeight: 1.5 }}>
          There is no structured event stream exposed to the browser yet — this reuses the audit trail (
          <code style={{ fontFamily: fonts.mono }}>/v1/audit/recent</code>), the closest real signal to a raw event
          log. For a human-readable version of the same data, see{' '}
          <a href="/activity" style={{ color: colors.accent }}>
            Live Activity
          </a>
          .
        </p>
      </header>

      {sorted.length === 0 ? (
        <Card>
          <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>No audit records yet.</p>
        </Card>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          {sorted.map((record) => (
            <div key={record.id} style={{ padding: 12, borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.surface }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: fonts.mono, fontSize: 12, fontWeight: 600 }}>{record.action}</span>
                <span style={{ fontSize: 11, color: colors.muted }}>{formatRelativeTime(record.occurredAt)}</span>
              </div>
              <div style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>
                {record.actor} · {record.resourceType}/{record.resourceId} · {record.outcome}
              </div>
              <div style={{ marginTop: 6 }}>
                <TechnicalDetailsDrawer data={{ ...record }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
