'use client';

import { motion } from 'framer-motion';
import { colors, fonts, radii } from '@umer/ui';
import { statusMeta, type StatusTone } from './status';

export function StatusBadge({ tone, label }: { tone: StatusTone; label?: string }) {
  const meta = statusMeta(tone);
  return (
    <motion.span
      key={tone}
      initial={{ opacity: 0, y: -2 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 9px',
        borderRadius: radii.sm,
        border: `1px solid ${colors.border}`,
        background: colors.surfaceRaised,
        fontFamily: fonts.mono,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.04em',
        color: meta.color,
        whiteSpace: 'nowrap',
      }}
    >
      <span aria-hidden>{meta.icon}</span>
      {label ?? meta.label}
    </motion.span>
  );
}
