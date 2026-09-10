'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Layers, FileCode, Cpu, Activity } from 'lucide-react';
import { colors } from '@umer/ui';

const TABS = [
  { href: '/delivery', label: 'Lifecycle Stage View', icon: Layers, exact: true },
  { href: '/delivery/requirements', label: 'Requirements & Scope', icon: FileCode },
  { href: '/delivery/engineering', label: 'Engineering Execution', icon: Cpu },
  { href: '/operations', label: 'Operations & SRE', icon: Activity },
];

export function DeliverySubNav() {
  const pathname = usePathname();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        paddingBottom: 2,
        marginBottom: 20,
        overflowX: 'auto',
        scrollbarWidth: 'none',
      }}
    >
      {TABS.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        const Icon = tab.icon;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: '8px 8px 0 0',
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: active ? 650 : 500,
              color: active ? colors.accent : colors.muted,
              background: active ? 'rgba(232, 160, 84, 0.1)' : 'transparent',
              borderBottom: active ? `2px solid ${colors.accent}` : '2px solid transparent',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            <Icon size={14} style={{ color: active ? colors.accent : colors.muted }} />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
