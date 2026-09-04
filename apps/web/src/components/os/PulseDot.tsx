'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { colors } from '@umer/ui';

export type PulseTone = 'live' | 'wait' | 'danger' | 'idle';

const FILL: Record<PulseTone, string> = {
  live: colors.success,
  wait: colors.warning,
  danger: colors.danger,
  idle: colors.muted,
};

export function PulseDot({ tone = 'live', size = 8 }: { tone?: PulseTone; size?: number }) {
  const reduce = useReducedMotion();
  const fill = FILL[tone];
  const pulse = tone !== 'idle' && !reduce;

  return (
    <span
      aria-hidden
      style={{
        position: 'relative',
        width: size,
        height: size,
        display: 'inline-block',
        flexShrink: 0,
      }}
    >
      {pulse ? (
        <motion.span
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 999,
            border: `1px solid ${fill}`,
          }}
          animate={{ opacity: [0.5, 0], scale: [1, 1.7] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }}
        />
      ) : null}
      <span
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 999,
          background: fill,
        }}
      />
    </span>
  );
}
