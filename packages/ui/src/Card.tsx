import type { CSSProperties, ReactNode } from 'react';
import { colors, fonts, radii, spacing } from './theme.js';

export type CardProps = {
  title?: string;
  children: ReactNode;
  style?: CSSProperties;
};

export function Card({ title, children, style }: CardProps) {
  return (
    <section
      style={{
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: radii.lg,
        padding: spacing.lg,
        boxShadow: '0 1px 0 rgba(255,255,255,0.03) inset',
        ...style,
      }}
    >
      {title ? (
        <h2
          style={{
            margin: `0 0 ${spacing.md}px`,
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: colors.muted,
            fontFamily: fonts.sans,
          }}
        >
          {title}
        </h2>
      ) : null}
      {children}
    </section>
  );
}
