'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { colors, fonts, spacing } from '@umer/ui';
import type { ActivityEntry } from '@/lib/company-derive';
import { formatDateLabel, formatTime } from './format';
import { TechnicalDetailsDrawer } from './TechnicalDetailsDrawer';
import { Pager, paginate } from './Pager';

const EXAMPLE_EVENTS = [
  '🧠 CEO selected an opportunity',
  '◆ Project created',
  '✓ Research agent completed competitor research',
  '⚙ Engineering agent started architecture',
];

export function ActivityFeed({ entries, limit, pageSize }: { entries: ActivityEntry[]; limit?: number; pageSize?: number }) {
  const [page, setPage] = useState(1);
  const pool = limit ? entries.slice(0, limit) : entries;
  const size = pageSize ?? pool.length;
  const shown = pageSize ? paginate(pool, page, size) : pool;
  const pageCount = Math.max(1, Math.ceil(pool.length / size));
  if (shown.length === 0) {
    return (
      <div>
        <p style={{ margin: '0 0 12px', color: colors.text, fontSize: 13, lineHeight: 1.6 }}>
          No company activity recorded yet. Every CEO decision and workflow milestone will appear here as it happens.
        </p>
        <p
          style={{
            margin: '0 0 6px',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: colors.muted,
          }}
        >
          A real entry will look like
        </p>
        <div style={{ display: 'grid', gap: 4, opacity: 0.5 }}>
          {EXAMPLE_EVENTS.map((event) => (
            <div key={event} style={{ fontSize: 12, color: colors.muted, fontStyle: 'italic' }}>
              {event}
            </div>
          ))}
        </div>
      </div>
    );
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
      {pageSize ? <Pager page={page} pageCount={pageCount} total={pool.length} pageSize={size} onPage={setPage} /> : null}
    </div>
  );
}
