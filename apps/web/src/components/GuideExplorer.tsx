'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge, Card, colors, fonts } from '@umer/ui';
import { GUIDE_SECTIONS } from '@/lib/guide-content';

export function GuideExplorer() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [selectedId, setSelectedId] = useState('overview');

  const categories = ['All', ...Array.from(new Set(GUIDE_SECTIONS.map((item) => item.category)))];
  const normalized = query.trim().toLowerCase();
  const results = useMemo(() => GUIDE_SECTIONS.filter((item) => {
    const matchesCategory = category === 'All' || item.category === category;
    if (!normalized) return matchesCategory;
    const haystack = [item.title, item.category, item.summary, ...item.keywords, ...item.content].join(' ').toLowerCase();
    return matchesCategory && haystack.includes(normalized);
  }), [category, normalized]);

  const selected = GUIDE_SECTIONS.find((item) => item.id === selectedId) ?? results[0] ?? GUIDE_SECTIONS[0];

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'flex-start' }}>
      <Card title="Umer AI OS Guide" style={{ flex: '1 1 260px', minWidth: 260 }}>
        <input
          aria-label="Search the Umer AI OS Guide"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search how agents, tasks, MCP, tokens work..."
          style={{ width: '100%', boxSizing: 'border-box', padding: '11px 12px', borderRadius: 8, border: `1px solid ${colors.border}`, background: '#0d0f14', color: colors.text, outline: 'none', fontFamily: fonts.sans, marginBottom: 12 }}
        />
        <select
          aria-label="Guide category"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8, border: `1px solid ${colors.border}`, background: '#0d0f14', color: colors.text, marginBottom: 14 }}
        >
          {categories.map((item) => <option key={item}>{item}</option>)}
        </select>
        <div style={{ display: 'grid', gap: 4 }}>
          {results.map((item) => (
            <button key={item.id} onClick={() => setSelectedId(item.id)} style={{ textAlign: 'left', padding: '10px 9px', borderRadius: 7, border: 0, cursor: 'pointer', background: item.id === selected.id ? '#20242d' : 'transparent', color: colors.text }}>
              <strong style={{ display: 'block', fontSize: 12 }}>{item.title}</strong>
              <span style={{ display: 'block', marginTop: 3, color: colors.muted, fontSize: 10 }}>{item.category}</span>
            </button>
          ))}
          {results.length === 0 && <p style={{ color: colors.muted, fontSize: 12 }}>No guide topics match this search.</p>}
        </div>
      </Card>

      <Card style={{ flex: '2 1 400px', minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start', flexWrap: 'wrap' }}>
          <div>
            <Badge tone="default">{selected.category}</Badge>
            <h2 style={{ margin: '10px 0 6px', fontSize: 22, letterSpacing: '-0.02em' }}>{selected.title}</h2>
            <p style={{ margin: 0, color: colors.muted, lineHeight: 1.55 }}>{selected.summary}</p>
          </div>
          <Link href="/command-center" style={{ color: colors.muted, fontSize: 11, textDecoration: 'none', whiteSpace: 'nowrap' }}>
            ← Command Center
          </Link>
        </div>
        <div style={{ marginTop: 22, display: 'grid', gap: 16 }}>
          {selected.content.map((paragraph) => <p key={paragraph} style={{ margin: 0, lineHeight: 1.7, fontSize: 13, color: '#d8d6d0' }}>{paragraph}</p>)}
        </div>
        <div style={{ marginTop: 22, paddingTop: 16, borderTop: `1px solid ${colors.border}` }}>
          <p style={{ margin: '0 0 8px', color: colors.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Searchable terms</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{selected.keywords.map((keyword) => <Badge key={keyword} tone="default">{keyword}</Badge>)}</div>
        </div>
      </Card>
    </div>
  );
}
