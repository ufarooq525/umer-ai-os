'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  LayoutDashboard,
  Share2,
  AlertTriangle,
  Scale,
  Bot,
  LayoutGrid,
  Sparkles,
  TrendingUp,
  Layers,
  HeartPulse,
  ArrowRight,
  X,
  FileText,
  Briefcase,
} from 'lucide-react';
import { colors, fonts, radii } from '@umer/ui';

type NavItem = {
  id: string;
  category: 'Command' | 'Navigation';
  title: string;
  subtitle: string;
  href: string;
  icon: typeof LayoutDashboard;
};

const DEFAULT_COMMANDS: NavItem[] = [
  { id: 'cmd-center', category: 'Navigation', title: 'Command Center', subtitle: 'Company executive control plane', href: '/command-center', icon: LayoutDashboard },
  { id: 'cmd-graph', category: 'Navigation', title: 'Company Graph', subtitle: 'Autonomous company brain visualization', href: '/company/graph', icon: Share2 },
  { id: 'cmd-attention', category: 'Command', title: 'Attention Center', subtitle: 'Review urgent & blocked signals', href: '/attention', icon: AlertTriangle },
  { id: 'cmd-decisions', category: 'Command', title: 'CEO Decisions', subtitle: 'Review and approve pending business decisions', href: '/decisions', icon: Scale },
  { id: 'cmd-agents', category: 'Navigation', title: 'AI Workforce / Agents', subtitle: 'Inspect active specialist agents', href: '/company/agents', icon: Bot },
  { id: 'cmd-projects', category: 'Navigation', title: 'Company Projects', subtitle: 'Delivery state across active projects', href: '/company/projects', icon: LayoutGrid },
  { id: 'cmd-opportunities', category: 'Navigation', title: 'Intelligence & Opportunities', subtitle: 'Ranked market opportunities & evidence', href: '/company/opportunities', icon: Sparkles },
  { id: 'cmd-sales', category: 'Navigation', title: 'Sales Pipeline', subtitle: 'Commercial deals, proposals, and CRM', href: '/sales', icon: TrendingUp },
  { id: 'cmd-delivery', category: 'Navigation', title: 'Delivery Lifecycle', subtitle: 'Requirements to release pipeline', href: '/delivery', icon: Layers },
  { id: 'cmd-finance', category: 'Navigation', title: 'Finance & Revenue', subtitle: 'Recognized revenue and lineage', href: '/finance', icon: Briefcase },
  { id: 'cmd-health', category: 'Navigation', title: 'System Health', subtitle: 'Infrastructure, NATS, and runtime truth', href: '/system-health', icon: HeartPulse },
];

type SearchResultItem = {
  entityType: string;
  entityId: string;
  title: string;
  summary: string;
  status: string;
  occurredAt: string;
};

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Reset query and focus on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
        if (!res.ok) throw new Error('Search failed');
        const data = (await res.json()) as { results?: SearchResultItem[] };
        setResults(data.results ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [query, open]);

  // Combined list of actionable items
  const combinedItems = query.trim().length >= 2
    ? results.map((r) => {
        let href = `/investigate/${encodeURIComponent(r.entityType)}/${encodeURIComponent(r.entityId)}`;
        if (r.entityType === 'opportunity') href = `/company/opportunities/${r.entityId}`;
        else if (r.entityType === 'agent') href = `/company/agents/${r.entityId}`;
        else if (r.entityType === 'project') href = `/company/projects/${r.entityId}`;

        return {
          id: `${r.entityType}-${r.entityId}`,
          category: r.entityType.toUpperCase(),
          title: r.title || r.entityId,
          subtitle: r.summary || `Status: ${r.status}`,
          href,
          badge: r.status,
        };
      })
    : DEFAULT_COMMANDS.filter((cmd) => {
        if (!query.trim()) return true;
        const q = query.toLowerCase();
        return cmd.title.toLowerCase().includes(q) || cmd.subtitle.toLowerCase().includes(q);
      });

  const handleSelect = useCallback(
    (href: string) => {
      onClose();
      router.push(href);
    },
    [onClose, router]
  );

  // Key navigation
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (combinedItems.length > 0 ? (prev + 1) % combinedItems.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (combinedItems.length > 0 ? (prev - 1 + combinedItems.length) % combinedItems.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const current = combinedItems[selectedIndex];
      if (current) {
        handleSelect(current.href);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '12vh',
        background: 'rgba(5, 7, 11, 0.75)',
        backdropFilter: 'blur(12px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 620,
          background: 'linear-gradient(180deg, #161a24 0%, #0f1219 100%)',
          borderRadius: 16,
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(232, 160, 84, 0.1)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '75vh',
        }}
        onKeyDown={onKeyDown}
      >
        {/* Search Input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '16px 18px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <Search size={18} style={{ color: colors.accent, flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search company, opportunities, agents, projects, decisions..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: colors.text,
              fontFamily: fonts.sans,
              fontSize: 15,
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: colors.muted,
                cursor: 'pointer',
                padding: 4,
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <X size={15} />
            </button>
          )}
          <span
            style={{
              fontSize: 10,
              fontFamily: fonts.mono,
              fontWeight: 600,
              padding: '3px 6px',
              borderRadius: 4,
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: colors.muted,
            }}
          >
            ESC
          </span>
        </div>

        {/* Results List */}
        <div style={{ overflowY: 'auto', padding: '8px', flex: 1 }}>
          {loading ? (
            <div style={{ padding: '24px', textAlign: 'center', color: colors.muted, fontSize: 13 }}>
              Searching live company state...
            </div>
          ) : combinedItems.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center' }}>
              <p style={{ margin: '0 0 6px', color: colors.text, fontSize: 14, fontWeight: 600 }}>No results found</p>
              <p style={{ margin: 0, color: colors.muted, fontSize: 12 }}>
                No records matching &quot;{query}&quot; in live database.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 4 }}>
              {combinedItems.map((item, idx) => {
                const active = idx === selectedIndex;
                const IconComponent = 'icon' in item && item.icon ? item.icon : FileText;

                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelect(item.href)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 14px',
                      borderRadius: radii.md,
                      background: active ? 'rgba(232, 160, 84, 0.12)' : 'transparent',
                      border: active ? '1px solid rgba(232, 160, 84, 0.3)' : '1px solid transparent',
                      cursor: 'pointer',
                      transition: 'background 0.12s ease',
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: active ? 'rgba(232, 160, 84, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                        display: 'grid',
                        placeItems: 'center',
                        color: active ? colors.accent : colors.muted,
                        flexShrink: 0,
                      }}
                    >
                      <IconComponent size={16} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            fontSize: 13.5,
                            fontWeight: 600,
                            color: active ? '#ffffff' : colors.text,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {item.title}
                        </span>
                        <span
                          style={{
                            fontSize: 9,
                            fontFamily: fonts.mono,
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                            padding: '1px 5px',
                            borderRadius: 4,
                            background: 'rgba(255, 255, 255, 0.05)',
                            color: colors.muted,
                          }}
                        >
                          {item.category}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 11.5,
                          color: colors.muted,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          marginTop: 2,
                        }}
                      >
                        {item.subtitle}
                      </div>
                    </div>
                    <ArrowRight
                      size={14}
                      style={{
                        color: active ? colors.accent : 'transparent',
                        flexShrink: 0,
                        transform: active ? 'translateX(0)' : 'translateX(-4px)',
                        transition: 'all 0.12s ease',
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '10px 18px',
            borderTop: '1px solid rgba(255, 255, 255, 0.07)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 11,
            color: colors.muted,
            background: 'rgba(0, 0, 0, 0.2)',
          }}
        >
          <div style={{ display: 'flex', gap: 14 }}>
            <span><strong style={{ color: colors.text }}>↑↓</strong> Navigate</span>
            <span><strong style={{ color: colors.text }}>↵</strong> Open</span>
            <span><strong style={{ color: colors.text }}>ESC</strong> Close</span>
          </div>
          <span style={{ fontFamily: fonts.mono, fontSize: 10 }}>UMER AI OS · EXECUTIVE BUS</span>
        </div>
      </div>
    </div>
  );
}
