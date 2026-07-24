'use client';

import { usePathname } from 'next/navigation';
import { Shell } from '@umer/ui';
import type { ReactNode } from 'react';

const navItems = [
  { href: '/', label: 'Dashboard' },
  { href: '/projects', label: 'Projects' },
  { href: '/gates', label: 'Gates' },
  { href: '/audit', label: 'Audit' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const items = navItems.map((item) => ({
    ...item,
    active: item.href === '/' ? pathname === '/' : pathname.startsWith(item.href),
  }));
  return <Shell navItems={items}>{children}</Shell>;
}
