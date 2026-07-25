import type { CSSProperties, ReactNode } from 'react';
import { colors, fonts, radii, spacing } from './theme.js';

export type BadgeTone = 'default' | 'success' | 'warning' | 'danger';

export type BadgeProps = {
  tone?: BadgeTone;
  children: ReactNode;
};

const toneStyles: Record<BadgeTone, CSSProperties> = {
  default: { background: colors.surfaceRaised, color: colors.muted, border: `1px solid ${colors.border}` },
  success: { background: 'rgba(93, 206, 160, 0.12)', color: colors.success, border: '1px solid rgba(93, 206, 160, 0.28)' },
  warning: { background: 'rgba(232, 184, 74, 0.12)', color: colors.warning, border: '1px solid rgba(232, 184, 74, 0.28)' },
  danger: { background: 'rgba(240, 113, 120, 0.12)', color: colors.danger, border: '1px solid rgba(240, 113, 120, 0.28)' },
};

export function Badge({ tone = 'default', children }: BadgeProps) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: `${spacing.xs}px 10px`,
        borderRadius: radii.sm,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        fontFamily: fonts.sans,
        ...toneStyles[tone],
      }}
    >
      {children}
    </span>
  );
}
