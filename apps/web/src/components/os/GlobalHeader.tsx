'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, AlertTriangle, ShieldCheck, Settings, ChevronRight } from 'lucide-react';
import { colors, fonts } from '@umer/ui';
import { PulseDot } from './PulseDot';

const ROUTE_INFO: Record<string, { title: string; subtitle: string; domain: string }> = {
  '/command-center': { title: 'Executive Command Center', subtitle: 'Real-time posture and operational truth across the company', domain: 'Executive' },
  '/company': { title: 'Company Overview', subtitle: 'Live map of all projects, agents, tasks, and opportunities', domain: 'Company' },
  '/company/agents': { title: 'AI Workforce', subtitle: 'Active autonomous specialist agents executing work', domain: 'Company' },
  '/company/projects': { title: 'Company Projects', subtitle: 'Active delivery projects and milestone health', domain: 'Company' },
  '/company/tasks': { title: 'Work Tasks', subtitle: 'Canonical task execution records across specialists', domain: 'Company' },
  '/company/graph': { title: 'Company Intelligence Graph', subtitle: 'Relational intelligence brain connecting market to revenue', domain: 'Company' },
  '/markets': { title: 'Market Intelligence', subtitle: 'Niche discovery, city rankings, and operator scan', domain: 'Intelligence' },
  '/company/opportunities': { title: 'Opportunity Intelligence', subtitle: 'Ranked high-value commercial and product opportunities', domain: 'Intelligence' },
  '/sales': { title: 'Commercial Sales Pipeline', subtitle: 'Deal progression, outreach drafts, proposals, and CRM', domain: 'Sales' },
  '/delivery': { title: 'Software & Product Delivery', subtitle: 'Canonical lifecycle: Requirements → Architecture → Eng → QA → Release', domain: 'Delivery' },
  '/finance': { title: 'Finance & Revenue Lineage', subtitle: 'Recognized revenue, margin multipliers, and customer success', domain: 'Finance' },
  '/decisions': { title: 'CEO Decision Plane', subtitle: 'High-leverage business decisions and commercial approvals', domain: 'Governance' },
  '/attention': { title: 'CEO Attention Center', subtitle: 'Urgent blockers, repeated agent failures, and threshold gates', domain: 'Governance' },
  '/gates': { title: 'System Quality Gates', subtitle: 'Human-in-the-loop and autonomous stage transition reviews', domain: 'Governance' },
  '/audit': { title: 'Governance Audit Trail', subtitle: 'Immutable chronological record of actions and policy evaluations', domain: 'Governance' },
  '/activity': { title: 'Executive Activity Stream', subtitle: 'High-signal narrative of completed work and specialist actions', domain: 'Company' },
  '/agent-runs': { title: 'Agent Execution Runs', subtitle: 'Live specialist execution runs and tool invocation telemetry', domain: 'System' },
  '/artifacts': { title: 'Sealed Company Artifacts', subtitle: 'Valuable outputs produced by specialists (PRDs, specs, reports)', domain: 'System' },
  '/events': { title: 'Message Fabric Events', subtitle: 'Real-time NATS event streams and distributed bus signals', domain: 'System' },
  '/system-health': { title: 'System Infrastructure Health', subtitle: 'NATS, MySQL, LLM Studio, and Control API runtime truth', domain: 'System' },
  '/settings': { title: 'Company Settings & Autonomy', subtitle: 'Autonomy thresholds, specialist mandates, and policies', domain: 'Governance' },
  '/seo': { title: 'SEO Sites & Owner Board', subtitle: 'Organic acquisition assets, deployments, and verification gates', domain: 'Intelligence' },
};

function getRouteMetadata(pathname: string) {
  if (ROUTE_INFO[pathname]) return ROUTE_INFO[pathname];
  // Sub-routes matching
  for (const [key, val] of Object.entries(ROUTE_INFO)) {
    if (pathname.startsWith(`${key}/`)) {
      return val;
    }
  }
  return { title: 'Autonomous Company OS', subtitle: 'Real-time executive control plane', domain: 'Umer AI OS' };
}

export function GlobalHeader({ onOpenCommandPalette }: { onOpenCommandPalette: () => void }) {
  const pathname = usePathname();
  const [attentionCount, setAttentionCount] = useState<number>(0);
  const [healthStatus, setHealthStatus] = useState<'healthy' | 'degraded' | 'offline'>('healthy');

  useEffect(() => {
    let alive = true;
    const loadState = async () => {
      try {
        const [attRes, truthRes] = await Promise.all([
          fetch('/api/attention-count', { cache: 'no-store' }),
          fetch('/api/runtime-truth', { cache: 'no-store' }),
        ]);
        if (!alive) return;
        if (attRes.ok) {
          const d = (await attRes.json()) as { count?: number };
          setAttentionCount(d.count ?? 0);
        }
        if (truthRes.ok) {
          const t = (await truthRes.json()) as { summary?: string };
          if (t.summary === 'All Systems Operational') setHealthStatus('healthy');
          else if (t.summary?.includes('Degraded')) setHealthStatus('degraded');
          else setHealthStatus('healthy');
        }
      } catch {
        // quiet fallback
      }
    };

    void loadState();
    const interval = setInterval(() => void loadState(), 30000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);

  const meta = useMemo(() => getRouteMetadata(pathname), [pathname]);

  // Derive breadcrumbs
  const breadcrumbs = useMemo(() => {
    const parts = pathname.split('/').filter(Boolean);
    const crumbs = [{ label: 'OS', href: '/command-center' }];
    let currentPath = '';
    for (const part of parts) {
      currentPath += `/${part}`;
      const name = part.charAt(0).toUpperCase() + part.slice(1).replace(/-/g, ' ');
      crumbs.push({ label: name, href: currentPath });
    }
    return crumbs;
  }, [pathname]);

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 15,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '12px clamp(16px, 3vw, 36px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
        background: 'rgba(11, 13, 18, 0.82)',
        backdropFilter: 'blur(16px)',
        minHeight: 64,
        boxSizing: 'border-box',
      }}
    >
      {/* Left: Context, Title, Breadcrumbs */}
      <div style={{ display: 'grid', gap: 3, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: colors.muted, fontFamily: fonts.mono }}>
          {breadcrumbs.map((crumb, idx) => (
            <span key={crumb.href} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {idx > 0 && <ChevronRight size={10} style={{ opacity: 0.5 }} />}
              {idx === breadcrumbs.length - 1 ? (
                <span style={{ color: colors.text, fontWeight: 600 }}>{crumb.label}</span>
              ) : (
                <Link href={crumb.href} style={{ color: colors.muted, textDecoration: 'none' }}>
                  {crumb.label}
                </Link>
              )}
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 'clamp(1.05rem, 1.6vw, 1.25rem)', fontWeight: 650, margin: 0, letterSpacing: '-0.025em', color: colors.text }}>
            {meta.title}
          </h1>
          <span style={{ fontSize: 11.5, color: colors.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 460 }}>
            {meta.subtitle}
          </span>
        </div>
      </div>

      {/* Center: Global Search Bar */}
      <div style={{ flex: '1 1 300px', maxWidth: 440, minWidth: 160 }}>
        <button
          type="button"
          onClick={onOpenCommandPalette}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            padding: '7px 14px',
            borderRadius: 10,
            border: '1px solid rgba(255, 255, 255, 0.09)',
            background: 'rgba(255, 255, 255, 0.035)',
            color: colors.muted,
            cursor: 'pointer',
            fontFamily: fonts.sans,
            fontSize: 12.5,
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.18)';
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.055)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.09)';
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.035)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
            <Search size={14} style={{ color: colors.accent, flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Search company &amp; entities...</span>
          </div>
          <span
            style={{
              fontFamily: fonts.mono,
              fontSize: 10,
              fontWeight: 600,
              padding: '2px 5px',
              borderRadius: 4,
              border: '1px solid rgba(255, 255, 255, 0.12)',
              background: 'rgba(0, 0, 0, 0.25)',
              color: colors.muted,
              flexShrink: 0,
            }}
          >
            ⌘K
          </span>
        </button>
      </div>

      {/* Right: Health, Attention Count, Gates, Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {/* System Health Pulse */}
        <Link
          href="/system-health"
          title="System infrastructure status"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            padding: '6px 10px',
            borderRadius: 8,
            border: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(255, 255, 255, 0.03)',
            textDecoration: 'none',
            color: colors.muted,
            fontSize: 11,
            fontFamily: fonts.mono,
          }}
        >
          <PulseDot tone={healthStatus === 'healthy' ? 'live' : healthStatus === 'degraded' ? 'wait' : 'danger'} />
          <span style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>SYSTEM</span>
        </Link>

        {/* CEO Attention Counter */}
        <Link
          href="/attention"
          title="CEO Attention Center"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            borderRadius: 8,
            border: attentionCount > 0 ? '1px solid rgba(232, 160, 84, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
            background: attentionCount > 0 ? 'rgba(232, 160, 84, 0.12)' : 'rgba(255, 255, 255, 0.03)',
            color: attentionCount > 0 ? colors.accent : colors.muted,
            textDecoration: 'none',
            fontSize: 11,
            fontFamily: fonts.mono,
            fontWeight: 700,
          }}
        >
          <AlertTriangle size={13} style={{ color: attentionCount > 0 ? colors.accent : colors.muted }} />
          <span>{attentionCount} ATTENTION</span>
        </Link>

        {/* Gates Shortcut */}
        <Link
          href="/gates"
          title="Quality &amp; Review Gates"
          style={{
            display: 'grid',
            placeItems: 'center',
            width: 32,
            height: 32,
            borderRadius: 8,
            border: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(255, 255, 255, 0.03)',
            color: colors.muted,
            textDecoration: 'none',
          }}
        >
          <ShieldCheck size={15} />
        </Link>

        {/* Settings */}
        <Link
          href="/settings"
          title="Company Settings"
          style={{
            display: 'grid',
            placeItems: 'center',
            width: 32,
            height: 32,
            borderRadius: 8,
            border: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(255, 255, 255, 0.03)',
            color: colors.muted,
            textDecoration: 'none',
          }}
        >
          <Settings size={15} />
        </Link>
      </div>
    </header>
  );
}
