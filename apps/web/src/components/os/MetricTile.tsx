'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { colors, fonts, radii, spacing } from '@umer/ui';

export type MetricTileProps = {
  label: string;
  value: number;
  sublines?: string[];
  href: string;
};

export function MetricTile({ label, value, sublines = [], href }: MetricTileProps) {
  return (
    <Link
      href={href}
      style={{
        display: 'block',
        padding: spacing.md,
        borderRadius: radii.lg,
        border: `1px solid ${colors.border}`,
        background: colors.surface,
        textDecoration: 'none',
        color: colors.text,
        transition: 'border-color 0.15s ease',
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: colors.muted,
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <motion.div
        key={value}
        initial={{ opacity: 0.4, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1 }}
      >
        {value}
      </motion.div>
      {sublines.length > 0 ? (
        <div style={{ marginTop: 8, display: 'grid', gap: 2 }}>
          {sublines.map((line) => (
            <div key={line} style={{ fontSize: 12, color: colors.muted, fontFamily: fonts.mono }}>
              {line}
            </div>
          ))}
        </div>
      ) : null}
    </Link>
  );
}
