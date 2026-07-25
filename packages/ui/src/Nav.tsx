import type { ReactNode } from 'react';
import { colors, fonts, radii, spacing } from './theme.js';

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
        gap: spacing.md,
        padding: `${spacing.md}px ${spacing.xl}px`,
        borderBottom: `1px solid ${colors.border}`,
        background: 'rgba(28, 31, 40, 0.85)',
        backdropFilter: 'blur(12px)',
        position: 'sticky',
        top: 0,
        zIndex: 20,
      }}
    >
      {brand ? (
        <div
          style={{
            fontWeight: 700,
            marginRight: spacing.lg,
            color: colors.text,
            letterSpacing: '-0.02em',
            fontSize: 15,
          }}
        >
          {brand}
        </div>
      ) : null}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {items.map((item) => (
          <a
            key={item.href}
            href={item.href}
            style={{
              color: item.active ? colors.text : colors.muted,
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: item.active ? 600 : 500,
              padding: '8px 12px',
              borderRadius: radii.sm,
              background: item.active ? colors.accentSoft : 'transparent',
              border: item.active ? `1px solid ${colors.borderStrong}` : '1px solid transparent',
              fontFamily: fonts.sans,
            }}
          >
            {item.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
