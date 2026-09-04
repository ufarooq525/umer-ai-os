'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { brandName, colors, fonts, radii, spacing } from '@umer/ui';
import { getAgentRuns, getAgents, getCommercialIntelligenceSummary, getOpportunities, getTasks, getWorkProjects } from '@/lib/control-api';
import { deriveAttentionCases } from '@/lib/company-derive';
import { deriveCommercialAttentionCases } from '@/lib/commercial-intelligence';

type NavEntry = { href: string; label: string; icon: string; badgeKey?: 'attention' };
type NavSection = { title: string; items: NavEntry[] };

const SECTIONS: NavSection[] = [
  { title: '', items: [{ href: '/command-center', label: 'Command Center', icon: '◈' }] },
  {
    title: 'Company',
    items: [
      { href: '/company', label: 'Company', icon: '◉' },
      { href: '/company/opportunities', label: 'Opportunities', icon: '✧' },
      { href: '/company/projects', label: 'Projects', icon: '▦' },
      { href: '/company/tasks', label: 'Tasks', icon: '☑' },
      { href: '/company/agents', label: 'Agents', icon: '◆' },
    ],
  },
  {
    title: 'Decisions',
    items: [
      { href: '/decisions', label: 'CEO Decisions', icon: '⚖' },
      { href: '/attention', label: 'Attention', icon: '⚠', badgeKey: 'attention' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { href: '/activity', label: 'Live Activity', icon: '▷' },
      { href: '/agent-runs', label: 'Agent Work', icon: '⏱' },
      { href: '/artifacts', label: 'Artifacts', icon: '✦' },
    ],
  },
  {
    title: 'Autonomy',
    items: [
      { href: '/autonomy#ceo', label: 'CEO', icon: '♛' },
      { href: '/autonomy#specialists', label: 'Specialists', icon: '●' },
      { href: '/autonomy#policies', label: 'Policies', icon: '☷' },
    ],
  },
  {
    title: 'System',
    items: [
      { href: '/events', label: 'Events', icon: '⚙' },
      { href: '/system-health', label: 'System Health', icon: '❤' },
    ],
  },
  { title: '', items: [{ href: '/settings', label: 'Settings', icon: '⚙' }] },
  {
    title: 'Legacy',
    items: [
      { href: '/', label: 'Legacy Console', icon: '□' },
      { href: '/projects', label: 'Codebases', icon: '□' },
      { href: '/gates', label: 'Gates', icon: '□' },
      { href: '/audit', label: 'Audit Log', icon: '□' },
      { href: '/guide', label: 'Guide', icon: '□' },
    ],
  },
];

function useAttentionCount(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [agents, agentRuns, projects, tasks, opportunities, commercialSummary] = await Promise.all([
          getAgents(),
          getAgentRuns(),
          getWorkProjects(),
          getTasks(),
          getOpportunities(),
          getCommercialIntelligenceSummary(),
        ]);
        const cases = deriveAttentionCases(agents, agentRuns, projects, tasks, opportunities);
        const commercialCases = deriveCommercialAttentionCases(commercialSummary);
        if (alive) setCount(cases.length + commercialCases.length);
      } catch {
        /* sidebar badge is best-effort; a control-api hiccup shouldn't break navigation */
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 20000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);
  return count;
}

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const attentionCount = useAttentionCount();

  useEffect(() => {
    const stored = window.localStorage.getItem('umer.sidebar.collapsed');
    if (stored === '1' || stored === '0') {
      setCollapsed(stored === '1');
      return;
    }
    // No explicit preference yet — default to collapsed on narrow viewports
    // (tablet/small laptop) so the sidebar doesn't crowd out real content.
    if (window.matchMedia('(max-width: 900px)').matches) setCollapsed(true);
  }, []);

  const toggle = () => {
    setCollapsed((prev) => {
      window.localStorage.setItem('umer.sidebar.collapsed', prev ? '0' : '1');
      return !prev;
    });
  };

  const isActive = (href: string) => {
    const base = href.split('#')[0]!;
    if (base === '/') return pathname === '/';
    return pathname === base || pathname.startsWith(`${base}/`);
  };

  return (
    <motion.nav
      animate={{ width: collapsed ? 64 : 232 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      style={{
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowY: 'auto',
        overflowX: 'hidden',
        flexShrink: 0,
        borderRight: `1px solid ${colors.border}`,
        background: 'rgba(20, 22, 29, 0.9)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 10,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          padding: `${spacing.md}px ${collapsed ? 0 : spacing.md}px`,
          borderBottom: `1px solid ${colors.border}`,
          minHeight: 56,
        }}
      >
        {!collapsed ? (
          <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-0.02em', color: colors.text }}>
            {brandName}
          </span>
        ) : null}
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            width: 28,
            height: 28,
            display: 'grid',
            placeItems: 'center',
            borderRadius: radii.sm,
            border: `1px solid ${colors.border}`,
            background: 'transparent',
            color: colors.muted,
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          {collapsed ? '›' : '‹'}
        </button>
      </div>

      <div style={{ padding: `${spacing.sm}px`, display: 'grid', gap: spacing.md, flex: 1 }}>
        {SECTIONS.map((section, idx) => (
          <div key={section.title || `s${idx}`}>
            {section.title && !collapsed ? (
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: colors.muted,
                  padding: '0 8px',
                  marginBottom: 6,
                }}
              >
                {section.title}
              </div>
            ) : null}
            <div style={{ display: 'grid', gap: 2 }}>
              {section.items.map((item) => {
                const active = isActive(item.href);
                const badge = item.badgeKey === 'attention' && attentionCount > 0 ? attentionCount : null;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: collapsed ? '8px 0' : '8px 10px',
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      borderRadius: radii.sm,
                      textDecoration: 'none',
                      color: active ? colors.text : colors.muted,
                      background: active ? colors.accentSoft : 'transparent',
                      border: active ? `1px solid ${colors.borderStrong}` : '1px solid transparent',
                      fontFamily: fonts.sans,
                      fontSize: 13,
                      fontWeight: active ? 600 : 500,
                      position: 'relative',
                    }}
                  >
                    <span style={{ fontSize: 13, width: 16, textAlign: 'center', flexShrink: 0 }} aria-hidden>
                      {item.icon}
                    </span>
                    <AnimatePresence initial={false}>
                      {!collapsed ? (
                        <motion.span
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.12 }}
                          style={{ overflow: 'hidden', whiteSpace: 'nowrap', flex: 1 }}
                        >
                          {item.label}
                        </motion.span>
                      ) : null}
                    </AnimatePresence>
                    {badge ? (
                      <span
                        style={{
                          fontFamily: fonts.mono,
                          fontSize: 10,
                          fontWeight: 700,
                          color: colors.accentText,
                          background: colors.accent,
                          borderRadius: 999,
                          minWidth: 16,
                          height: 16,
                          padding: '0 4px',
                          display: 'grid',
                          placeItems: 'center',
                          position: collapsed ? 'absolute' : 'static',
                          top: collapsed ? 2 : undefined,
                          right: collapsed ? 2 : undefined,
                        }}
                      >
                        {badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </motion.nav>
  );
}
