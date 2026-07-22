import type { ReactNode } from 'react';
import { colors, spacing } from './theme.js';

export type NavItem = {
  href: string;
  label: string;
  active?: boolean;
};

export type NavProps = {
  items: NavItem[];
  brand?: ReactNode;
};

export function Nav({ items, brand }: NavProps) {
  return (
    <nav
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing.lg,
        padding: `${spacing.md}px ${spacing.xl}px`,
        borderBottom: `1px solid ${colors.border}`,
        background: colors.surface,
      }}
    >
      {brand ? (
        <div style={{ fontWeight: 600, marginRight: spacing.lg, color: colors.text }}>{brand}</div>
      ) : null}
      {items.map((item) => (
        <a
          key={item.href}
          href={item.href}
          style={{
            color: item.active ? colors.accent : colors.muted,
            textDecoration: 'none',
            fontSize: 14,
            fontWeight: item.active ? 600 : 400,
          }}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
