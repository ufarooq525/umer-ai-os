'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Card, colors, fonts } from '@umer/ui';
import type { LiveActivityEntry } from '@/lib/company-derive';
import { formatRelativeTime } from './format';

const EXAMPLE_EVENTS = [
  'Opportunity discovered',
  'Agent started research',
  'Prospect identified',
  'Evidence collected',
  'Decision requested',
  'Project created',
];

/**
 * Real agent-run play-by-play (AgentRunSnapshot.actionLog), not a fabricated
 * conversation — every line here is a factual statement the Runtime
 * Observability reducer already produced ("Requested tool ...", "Tool ...
 * completed in Xms"), just laid out as a connected flow per the product spec.
 */
export function LiveActivityStream({ entries }: { entries: LiveActivityEntry[] }) {
  return (
    <Card title="Live Company Activity">
      {entries.length === 0 ? (
        <div>
          <p style={{ margin: '0 0 12px', color: colors.text, fontSize: 13, lineHeight: 1.6 }}>
            No live activity yet. The company activity feed will appear here once agents begin executing work.
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
            Your first activity will look like
          </p>
          <div style={{ display: 'grid', gap: 4, opacity: 0.5 }}>
            {EXAMPLE_EVENTS.map((event) => (
              <div key={event} style={{ fontSize: 12, color: colors.muted, fontStyle: 'italic' }}>
                ● {event}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 0 }}>
          <AnimatePresence initial={false}>
            {entries.map((entry, idx) => (
              <motion.div
                key={entry.id}
                layout
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '52px 1fr', gap: 10, padding: '8px 0' }}>
                  <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.muted, paddingTop: 2 }}>
                    {formatRelativeTime(entry.at)}
                  </span>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: colors.accent }}>{entry.agentLabel}</span>
                    <span style={{ fontSize: 13, color: colors.text }}> — {entry.summary}</span>
                  </div>
                </div>
                {idx < entries.length - 1 ? (
                  <div style={{ paddingLeft: 22, color: colors.border, fontSize: 12, lineHeight: 1 }}>↓</div>
                ) : null}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </Card>
  );
}
