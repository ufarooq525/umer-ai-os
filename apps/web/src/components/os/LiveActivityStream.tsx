'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Card, colors, fonts } from '@umer/ui';
import type { LiveActivityEntry } from '@/lib/company-derive';
import { formatRelativeTime } from './format';

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
        <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>No agent activity recorded yet.</p>
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
