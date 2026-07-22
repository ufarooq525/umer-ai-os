import type { CSSProperties, ReactNode } from 'react';
import { colors, spacing } from './theme.js';

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
        borderRadius: 8,
        padding: spacing.lg,
        ...style,
      }}
    >
      {title ? (
        <h2
          style={{
            margin: `0 0 ${spacing.md}px`,
            fontSize: 16,
            fontWeight: 600,
            color: colors.text,
          }}
        >
          {title}
        </h2>
      ) : null}
      {children}
    </section>
  );
}
