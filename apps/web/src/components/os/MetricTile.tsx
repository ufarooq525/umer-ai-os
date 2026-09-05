'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { colors, fonts, radii, spacing } from '@umer/ui';

export type MetricTileProps = {
  label: string;
  value: number;
  sublines?: string[];
  href: string;
};

export function MetricTile({ label, value, sublines = [], href }: MetricTileProps) {
  const reduce = useReducedMotion();
  const hot = value > 0;

  return (
    <Link href={href} style={{ textDecoration: 'none', color: colors.text, display: 'block' }}>
      <motion.div
        whileHover={reduce ? undefined : { y: -2 }}
        transition={{ duration: 0.18 }}
        style={{
          padding: spacing.md,
          borderRadius: radii.lg,
          border: `1px solid ${hot ? colors.borderStrong : colors.border}`,
          background: colors.surface,
          minHeight: 118,
          boxSizing: 'border-box',
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
        <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1, color: hot ? colors.text : colors.muted }}>
          {value}
        </div>
        {sublines.length > 0 ? (
          <div style={{ marginTop: 8, display: 'grid', gap: 2 }}>
            {sublines.map((line) => (
              <div key={line} style={{ fontSize: 12, color: colors.muted, fontFamily: fonts.mono }}>
                {line}
              </div>
            ))}
          </div>
        ) : null}
      </motion.div>
    </Link>
  );
}
