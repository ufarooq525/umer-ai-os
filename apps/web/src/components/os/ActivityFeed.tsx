'use client';

import { motion } from 'framer-motion';
import { colors, fonts, spacing } from '@umer/ui';
import type { ActivityEntry } from '@/lib/company-derive';
import { formatDateLabel, formatTime } from './format';
import { TechnicalDetailsDrawer } from './TechnicalDetailsDrawer';

export function ActivityFeed({ entries, limit }: { entries: ActivityEntry[]; limit?: number }) {
  const shown = limit ? entries.slice(0, limit) : entries;
  if (shown.length === 0) {
    return <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>No company activity recorded yet.</p>;
  }

  const groups: Array<{ label: string; entries: ActivityEntry[] }> = [];
  for (const entry of shown) {
    const label = formatDateLabel(entry.at);
    const group = groups[groups.length - 1];
    if (group && group.label === label) group.entries.push(entry);
    else groups.push({ label, entries: [entry] });
  }

  return (
    <div style={{ display: 'grid', gap: spacing.lg }}>
      {groups.map((group) => (
        <div key={group.label}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: colors.muted,
              marginBottom: 8,
            }}
          >
            {group.label}
          </div>
          <div style={{ display: 'grid', gap: 2 }}>
            {group.entries.map((entry) => (
              <motion.div
                key={entry.id}
                layout
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '56px 20px 1fr',
                  gap: 10,
                  alignItems: 'start',
                  padding: '10px 0',
                  borderBottom: `1px solid ${colors.border}`,
                }}
              >
                <span style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.muted, paddingTop: 1 }}>
                  {formatTime(entry.at)}
                </span>
                <span aria-hidden style={{ fontSize: 13 }}>
                  {entry.icon}
                </span>
                <div>
                  <div style={{ fontSize: 13, color: colors.text }}>{entry.headline}</div>
                  <div style={{ marginTop: 4 }}>
                    <TechnicalDetailsDrawer data={entry.technical} />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
