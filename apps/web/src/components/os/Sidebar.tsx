'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { brandName, colors, fonts, radii, spacing } from '@umer/ui';

type NavEntry = { href: string; label: string; icon: string; badgeKey?: 'attention' };
type NavSection = { title: string; items: NavEntry[] };

const SECTIONS: NavSection[] = [
  { title: '', items: [{ href: '/command-center', label: 'Command Center', icon: '◈' }] },
  { title: 'Company', items: [
    { href: '/company', label: 'Company', icon: '◉' }, { href: '/markets', label: 'Markets', icon: '◎' },
    { href: '/company/opportunities', label: 'Opportunities', icon: '✧' }, { href: '/company/projects', label: 'Projects', icon: '▦' },
    { href: '/company/tasks', label: 'Tasks', icon: '☑' }, { href: '/company/agents', label: 'Agents', icon: '◆' }, { href: '/seo', label: 'SEO Sites', icon: '◈' },
  ] },
  { title: 'Decisions', items: [
    { href: '/decisions', label: 'CEO Decisions', icon: '⚖' }, { href: '/attention', label: 'Attention', icon: '⚠', badgeKey: 'attention' }, { href: '/gates', label: 'Gates', icon: '▣' },
  ] },
  { title: 'Work', items: [
    { href: '/projects', label: 'Codebases', icon: '▦' }, { href: '/operations', label: 'Operations', icon: '▷' }, { href: '/activity', label: 'Live Activity', icon: '▷' }, { href: '/agent-runs', label: 'Agent Work', icon: '⏱' }, { href: '/artifacts', label: 'Artifacts', icon: '✦' },
  ] },
  { title: 'Autonomy', items: [
    { href: '/autonomy#ceo', label: 'CEO', icon: '♛' }, { href: '/autonomy#specialists', label: 'Specialists', icon: '●' }, { href: '/autonomy#policies', label: 'Policies', icon: '☷' },
  ] },
  { title: 'System', items: [
    { href: '/events', label: 'Events', icon: '⚙' }, { href: '/system-health', label: 'System Health', icon: '❤' }, { href: '/audit', label: 'Audit Log', icon: '□' }, { href: '/guide', label: 'Guide', icon: '□' },
  ] },
  { title: '', items: [{ href: '/settings', label: 'Settings', icon: '⚙' }] },
];

function useAttentionCount(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = async () => { try { const response = await fetch('/api/attention-count', { cache: 'no-store' }); const payload = (await response.json()) as { count?: number }; if (alive) setCount(payload.count ?? 0); } catch {} };
    void load(); const timer = window.setInterval(() => void load(), 45000); return () => { alive = false; window.clearInterval(timer); };
  }, []);
  return count;
}

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const attentionCount = useAttentionCount();

  useEffect(() => {
    const stored = window.localStorage.getItem('umer.sidebar.collapsed');
    if (stored === '1' || stored === '0') { setCollapsed(stored === '1'); return; }
    if (window.matchMedia('(max-width: 900px)').matches) setCollapsed(true);
  }, []);

  const toggle = () => setCollapsed((prev) => { window.localStorage.setItem('umer.sidebar.collapsed', prev ? '0' : '1'); return !prev; });
  const isActive = (href: string) => { const base = href.split('#')[0]!; return base === '/' ? pathname === '/' : pathname === base || pathname.startsWith(`${base}/`); };

  return (
    <motion.nav
      className="os-sidebar"
      animate={{ width: collapsed ? 64 : 232 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      style={{
        position: 'sticky', top: 0, height: '100vh', overflowY: 'auto', overflowX: 'hidden', flexShrink: 0,
        borderRight: '1px solid rgba(255,255,255,.07)', background: 'rgba(15,17,23,.78)', backdropFilter: 'blur(18px)',
        display: 'flex', flexDirection: 'column', zIndex: 20, boxShadow: '18px 0 50px rgba(0,0,0,.12)',
      }}
    >
      <style>{`@media(max-width:900px){.os-sidebar{position:fixed!important;left:0;top:0;box-shadow:18px 0 60px rgba(0,0,0,.35)!important}.os-sidebar a{min-height:42px}}`}</style>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', padding: `${spacing.md}px ${collapsed ? 0 : spacing.md}px`, borderBottom: '1px solid rgba(255,255,255,.07)', minHeight: 64 }}>
        {!collapsed ? <div><span style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-0.03em', color: colors.text }}>{brandName}</span><div style={{ color: colors.muted, fontSize: 9, marginTop: 3, letterSpacing: '.12em', textTransform: 'uppercase' }}>Company OS</div></div> : null}
        <button type="button" onClick={toggle} aria-label={collapsed ? 'Open navigation' : 'Collapse navigation'} style={{ width: 30, height: 30, display: 'grid', placeItems: 'center', borderRadius: 9, border: '1px solid rgba(255,255,255,.09)', background: 'rgba(255,255,255,.04)', color: colors.muted, cursor: 'pointer', fontSize: 14 }}>
          {collapsed ? '›' : '‹'}
        </button>
      </div>
      <div style={{ padding: `${spacing.sm}px`, display: 'grid', gap: spacing.md, flex: 1 }}>
        {SECTIONS.map((section, idx) => (
          <div key={section.title || `s${idx}`}>
            {section.title && !collapsed ? <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#737987', padding: '0 10px', marginBottom: 6 }}>{section.title}</div> : null}
            <div style={{ display: 'grid', gap: 3 }}>
              {section.items.map((item) => {
                const active = isActive(item.href); const badge = item.badgeKey === 'attention' && attentionCount > 0 ? attentionCount : null;
                return <Link key={item.href} href={item.href} title={collapsed ? item.label : undefined} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: collapsed ? '9px 0' : '9px 10px', justifyContent: collapsed ? 'center' : 'flex-start', borderRadius: 10, textDecoration: 'none', color: active ? colors.text : colors.muted, background: active ? 'linear-gradient(90deg, rgba(255,255,255,.075), rgba(255,255,255,.025))' : 'transparent', border: active ? '1px solid rgba(255,255,255,.09)' : '1px solid transparent', fontFamily: fonts.sans, fontSize: 12.5, fontWeight: active ? 600 : 500, position: 'relative', transition: 'background .18s ease, color .18s ease, transform .18s ease' }}>
                  <span style={{ fontSize: 13, width: 16, textAlign: 'center', flexShrink: 0, opacity: active ? 1 : .75 }} aria-hidden>{item.icon}</span>
                  <AnimatePresence initial={false}>{!collapsed ? <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .12 }} style={{ overflow: 'hidden', whiteSpace: 'nowrap', flex: 1 }}>{item.label}</motion.span> : null}</AnimatePresence>
                  {badge ? <span style={{ fontFamily: fonts.mono, fontSize: 9, fontWeight: 700, color: colors.accentText, background: colors.accent, borderRadius: 999, minWidth: 17, height: 17, padding: '0 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: collapsed ? 'absolute' : 'static', top: collapsed ? 2 : undefined, right: collapsed ? 2 : undefined }}>{badge}</span> : null}
                </Link>;
              })}
            </div>
          </div>
        ))}
      </div>
    </motion.nav>
  );
}
