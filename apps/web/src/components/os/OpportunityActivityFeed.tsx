import { colors, fonts } from '@umer/ui';
import type { OpportunityActivityEntry } from '@/lib/commercial-intelligence';
import { TechnicalDetailsDrawer } from './TechnicalDetailsDrawer';
import { formatTime } from './format';

/** Same visual language as V2's ActivityFeed, sized for a per-opportunity run's OpportunityRunEvent trail. */
export function OpportunityActivityFeed({ entries }: { entries: OpportunityActivityEntry[] }) {
  if (entries.length === 0) {
    return <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>No research activity recorded for this run yet.</p>;
  }
  return (
    <div style={{ display: 'grid', gap: 2 }}>
      {entries.map((entry) => (
        <div
          key={entry.id}
          style={{
            display: 'grid',
            gridTemplateColumns: '56px 20px 1fr',
            gap: 10,
            alignItems: 'start',
            padding: '10px 0',
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          <span style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.muted, paddingTop: 1 }}>{formatTime(entry.at)}</span>
          <span aria-hidden style={{ fontSize: 13 }}>
            {entry.icon}
          </span>
          <div>
            <div style={{ fontSize: 13, color: colors.text }}>{entry.headline}</div>
            <div style={{ marginTop: 4 }}>
              <TechnicalDetailsDrawer data={entry.technical} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
