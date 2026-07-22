import type { CSSProperties, ReactNode } from 'react';
import { colors, spacing } from './theme.js';

export type BadgeTone = 'default' | 'success' | 'warning' | 'danger';

export type BadgeProps = {
  tone?: BadgeTone;
  children: ReactNode;
};

const toneStyles: Record<BadgeTone, CSSProperties> = {
  default: { background: colors.border, color: colors.text },
  success: { background: '#1e3d2f', color: colors.success },
  warning: { background: '#3d3018', color: colors.warning },
  danger: { background: '#3d1e1e', color: colors.danger },
};

export function Badge({ tone = 'default', children }: BadgeProps) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: `${spacing.xs}px ${spacing.sm}px`,
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        ...toneStyles[tone],
      }}
    >
      {children}
    </span>
  );
}
