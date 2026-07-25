import type { ReactNode } from 'react';
import { Nav, type NavItem } from './Nav.js';
import { brandName } from './brand.js';
import { colors, fonts, spacing } from './theme.js';

export type ShellProps = {
  children: ReactNode;
  navItems: NavItem[];
};

export function Shell({ children, navItems }: ShellProps) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: `
          radial-gradient(1200px 500px at 10% -10%, ${colors.accentSoft}, transparent 55%),
          linear-gradient(180deg, #161922 0%, ${colors.bg} 40%, #0e1015 100%)
        `,
        color: colors.text,
        fontFamily: fonts.sans,
      }}
    >
      <Nav items={navItems} brand={brandName} />
      <main
        style={{
          padding: `${spacing.xl}px ${spacing.lg}px ${spacing.xxl}px`,
          maxWidth: 1100,
          margin: '0 auto',
        }}
      >
        {children}
      </main>
    </div>
  );
}
