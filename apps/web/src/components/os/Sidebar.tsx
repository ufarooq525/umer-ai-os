'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Building2,
  Share2,
  Globe,
  Sparkles,
  LayoutGrid,
  CheckSquare,
  Bot,
  Search,
  Scale,
  AlertTriangle,
  ShieldCheck,
  FolderGit2,
  Activity,
  Radio,
  Clock,
  FileText,
  DollarSign,
  TrendingUp,
  Layers,
  Zap,
  HeartPulse,
  ScrollText,
  BookOpenCheck,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Users,
  Briefcase,
  type LucideIcon,
} from 'lucide-react';
import { brandName, colors, fonts } from '@umer/ui';

type NavEntry = {
  href: string;
  label: string;
  icon: LucideIcon;
  badgeKey?: 'attention';
};

type NavGroup = {
  id: string;
  title: string;
  icon: LucideIcon;
  items: NavEntry[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'opportunities',
    title: 'Opportunities & Leads',
    icon: Sparkles,
    items: [
      { href: '/company/opportunities', label: 'Opportunities', icon: Sparkles },
      { href: '/company/prospects', label: 'Prospects', icon: Users },
      { href: '/markets', label: 'Markets & Niches', icon: Globe },
      { href: '/seo', label: 'SEO Sites', icon: Search },
    ],
  },
  {
    id: 'approvals',
    title: 'Approvals & Decisions',
    icon: Scale,
    items: [
      { href: '/decisions', label: 'Approvals', icon: Scale },
      { href: '/gates', label: 'Quality Review', icon: ShieldCheck },
      { href: '/attention', label: 'Attention Items', icon: AlertTriangle, badgeKey: 'attention' },
    ],
  },
  {
    id: 'agents',
    title: 'Agents & Work',
    icon: Bot,
    items: [
      { href: '/company/agents', label: 'Agents', icon: Bot },
      { href: '/company/projects', label: 'Projects', icon: LayoutGrid },
      { href: '/company/tasks', label: 'Tasks', icon: CheckSquare },
      { href: '/activity', label: 'Activity', icon: Radio },
    ],
  },
  {
    id: 'sales',
    title: 'Sales',
    icon: TrendingUp,
    items: [
      { href: '/sales', label: 'Pipeline (CRM)', icon: TrendingUp },
      { href: '/sales/proposals', label: 'Proposals', icon: FileText },
      { href: '/sales/customers', label: 'Customers', icon: Users },
    ],
  },
  {
    id: 'finance',
    title: 'Finance',
    icon: DollarSign,
    items: [
      { href: '/finance', label: 'Revenue & Outcomes', icon: DollarSign },
    ],
  },
  {
    id: 'advanced',
    title: 'Advanced',
    icon: Settings,
    items: [
      { href: '/company', label: 'Company Overview', icon: Building2 },
      { href: '/company/graph', label: 'Company Graph', icon: Share2 },
      { href: '/delivery', label: 'Delivery', icon: Layers },
      { href: '/delivery/requirements', label: 'Requirements', icon: FileText },
      { href: '/projects', label: 'Codebases & Repos', icon: FolderGit2 },
      { href: '/operations', label: 'Operations', icon: Activity },
      { href: '/agent-runs', label: 'Agent Runs', icon: Clock },
      { href: '/artifacts', label: 'Artifacts', icon: FileText },
      { href: '/audit', label: 'Audit Log', icon: ScrollText },
      { href: '/autonomy', label: 'Autonomy & Mandates', icon: Briefcase },
      { href: '/events', label: 'Message Fabric', icon: Zap },
      { href: '/system-health', label: 'System Health', icon: HeartPulse },
      { href: '/guide', label: 'Guide & Docs', icon: BookOpenCheck },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

function useAttentionCount(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const response = await fetch('/api/attention-count', { cache: 'no-store' });
        const payload = (await response.json()) as { count?: number };
        if (alive) setCount(payload.count ?? 0);
      } catch {}
    };
    void load();
    const timer = window.setInterval(() => void load(), 30000);
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
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    opportunities: true,
    approvals: true,
    agents: true,
    sales: true,
    finance: true,
    advanced: false,
  });
  const attentionCount = useAttentionCount();

  useEffect(() => {
    const storedCollapsed = window.localStorage.getItem('umer.sidebar.collapsed');
    if (storedCollapsed === '1' || storedCollapsed === '0') {
      setCollapsed(storedCollapsed === '1');
    } else if (window.matchMedia('(max-width: 900px)').matches) {
      setCollapsed(true);
    }

    const storedGroups = window.localStorage.getItem('umer.sidebar.groups');
    if (storedGroups) {
      try {
        setOpenGroups((prev) => ({ ...prev, ...JSON.parse(storedGroups) }));
      } catch {}
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem('umer.sidebar.collapsed', next ? '1' : '0');
      return next;
    });
  };

  const toggleGroup = (id: string) => {
    if (collapsed) {
      setCollapsed(false);
      setOpenGroups((prev) => ({ ...prev, [id]: true }));
      return;
    }
    setOpenGroups((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      window.localStorage.setItem('umer.sidebar.groups', JSON.stringify(next));
      return next;
    });
  };

  const isActive = (href: string) => {
    const base = href.split('#')[0]!;
    if (base === '/command-center' || base === '/') {
      return pathname === '/' || pathname === '/command-center';
    }
    return pathname === base || pathname.startsWith(`${base}/`);
  };

  return (
    <motion.nav
      className="os-sidebar"
      animate={{ width: collapsed ? 68 : 244 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      style={{
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowY: 'auto',
        overflowX: 'hidden',
        flexShrink: 0,
        borderRight: '1px solid rgba(255, 255, 255, 0.07)',
        background: 'rgba(12, 14, 20, 0.86)',
        backdropFilter: 'blur(20px)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 20,
        boxShadow: '16px 0 45px rgba(0, 0, 0, 0.22)',
      }}
    >
      <style>{`
        @media(max-width:900px){
          .os-sidebar{ position:fixed!important; left:0; top:0; box-shadow:18px 0 60px rgba(0,0,0,.45)!important; }
        }
        .sidebar-scroll::-webkit-scrollbar { width: 4px; }
        .sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }
      `}</style>

      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          padding: '16px 14px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
          minHeight: 64,
          boxSizing: 'border-box',
        }}
      >
        {!collapsed && (
          <Link href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 7,
                  background: 'linear-gradient(135deg, #e8a054 0%, #c07d34 100%)',
                  display: 'grid',
                  placeItems: 'center',
                  fontWeight: 800,
                  fontSize: 13,
                  color: '#120d06',
                  fontFamily: fonts.mono,
                  boxShadow: '0 2px 10px rgba(232, 160, 84, 0.35)',
                }}
              >
                U
              </div>
              <div>
                <span style={{ fontWeight: 700, fontSize: 13.5, letterSpacing: '-0.03em', color: colors.text }}>
                  {brandName}
                </span>
                <div style={{ color: colors.muted, fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 600 }}>
                  Autonomous OS
                </div>
              </div>
            </div>
          </Link>
        )}

        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          style={{
            width: 28,
            height: 28,
            display: 'grid',
            placeItems: 'center',
            borderRadius: 7,
            border: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(255, 255, 255, 0.03)',
            color: colors.muted,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Navigation Groups */}
      <div className="sidebar-scroll" style={{ padding: '12px 10px', display: 'grid', gap: 14, flex: 1, overflowY: 'auto' }}>
        {/* Pinned Home */}
        <div>
          {(() => {
            const active = isActive('/');
            return (
              <Link
                href="/"
                title={collapsed ? 'Home' : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: collapsed ? '10px 0' : '9px 12px',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  borderRadius: 10,
                  textDecoration: 'none',
                  color: active ? '#ffffff' : colors.text,
                  background: active ? 'linear-gradient(90deg, rgba(232, 160, 84, 0.18), rgba(232, 160, 84, 0.05))' : 'rgba(255, 255, 255, 0.02)',
                  border: active ? '1px solid rgba(232, 160, 84, 0.4)' : '1px solid rgba(255, 255, 255, 0.05)',
                  fontSize: 12.5,
                  fontWeight: active ? 650 : 500,
                  transition: 'all 0.15s ease',
                }}
              >
                <LayoutDashboard size={16} style={{ color: active ? colors.accent : colors.muted, flexShrink: 0 }} />
                {!collapsed && <span>Home</span>}
              </Link>
            );
          })()}
        </div>

        {/* Grouped sections */}
        {NAV_GROUPS.map((group) => {
          const isOpen = !!openGroups[group.id];
          const hasActiveChild = group.items.some((item) => isActive(item.href));

          return (
            <div key={group.id} style={{ display: 'grid', gap: 4 }}>
              {!collapsed ? (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '5px 8px',
                    background: 'transparent',
                    border: 'none',
                    color: hasActiveChild ? colors.accent : '#767c8d',
                    cursor: 'pointer',
                    fontSize: 9.5,
                    fontWeight: 700,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                  }}
                >
                  <span>{group.title}</span>
                  <ChevronDown
                    size={12}
                    style={{
                      transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                      transition: 'transform 0.15s ease',
                      opacity: 0.7,
                    }}
                  />
                </button>
              ) : null}

              {(isOpen || collapsed) && (
                <div style={{ display: 'grid', gap: 2 }}>
                  {group.items.map((item) => {
                    const active = isActive(item.href);
                    const badge = item.badgeKey === 'attention' && attentionCount > 0 ? attentionCount : null;
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: collapsed ? '8px 0' : '7.5px 10px',
                          justifyContent: collapsed ? 'center' : 'flex-start',
                          borderRadius: 8,
                          textDecoration: 'none',
                          color: active ? '#ffffff' : '#9ca3b5',
                          background: active ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                          border: active ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid transparent',
                          fontSize: 12,
                          fontWeight: active ? 600 : 500,
                          position: 'relative',
                          transition: 'all 0.12s ease',
                        }}
                      >
                        <span style={{ width: 16, display: 'grid', placeItems: 'center', flexShrink: 0, opacity: active ? 1 : 0.75 }}>
                          <Icon size={14.5} strokeWidth={active ? 2 : 1.7} />
                        </span>

                        {!collapsed && (
                          <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', flex: 1, textOverflow: 'ellipsis' }}>
                            {item.label}
                          </span>
                        )}

                        {badge ? (
                          <span
                            style={{
                              fontFamily: fonts.mono,
                              fontSize: 9,
                              fontWeight: 700,
                              color: '#1a1208',
                              background: colors.accent,
                              borderRadius: 999,
                              minWidth: 16,
                              height: 16,
                              padding: '0 4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
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
              )}
            </div>
          );
        })}
      </div>
    </motion.nav>
  );
}
