import type { ReactNode } from 'react';
import { Nav, type NavItem } from './Nav.js';
import { brandName } from './brand.js';
import { colors } from './theme.js';

export type ShellProps = {
  children: ReactNode;
  navItems: NavItem[];
};

export function Shell({ children, navItems }: ShellProps) {
  return (
    <div style={{ minHeight: '100vh', background: colors.bg, color: colors.text }}>
      <Nav items={navItems} brand={brandName} />
      <main style={{ padding: '2rem', maxWidth: 960, margin: '0 auto' }}>{children}</main>
    </div>
  );
}
