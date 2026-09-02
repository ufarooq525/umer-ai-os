'use client';

import { useEffect, useState } from 'react';
import { Badge, Card, colors, fonts } from '@umer/ui';

type SearchResult = {
  entityType: string;
  entityId: string;
  title: string;
  summary: string;
  status: string | null;
  occurredAt: string | null;
};

const labels: Record<string, string> = {
  agent: 'Agent', task: 'Task', run: 'Run', niche: 'Niche', business: 'Business',
  opportunity: 'Opportunity', evidence: 'Evidence', problem: 'Problem', outreach: 'Outreach',
  workflow_event: 'Kernel Event', run_event: 'Run Event',
};

export function GlobalAISearch({ compact = false }: { compact?: boolean }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const value = query.trim();
    if (value.length < 2) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(value)}`, { cache: 'no-store', signal: controller.signal });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? 'Search failed');
        setResults(payload.results ?? []);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query]);

  return (
    <Card title={compact ? undefined : 'Global AI OS Search'}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search agents, tasks, runs, businesses, opportunities, evidence..."
          aria-label="Global AI OS search"
          style={{ flex: 1, minWidth: 0, padding: '11px 13px', borderRadius: 8, border: `1px solid ${colors.border}`, background: 'transparent', color: 'inherit', fontSize: 14 }}
        />
        {loading && <span style={{ color: colors.muted, fontSize: 12 }}>Searching…</span>}
      </div>

      {error && <p style={{ color: colors.danger ?? colors.muted, fontSize: 13, margin: '10px 0 0' }}>{error}</p>}
      {!error && query.trim().length === 1 && <p style={{ color: colors.muted, fontSize: 12, margin: '10px 0 0' }}>Enter at least 2 characters.</p>}
      {!error && query.trim().length >= 2 && !loading && results.length === 0 && <p style={{ color: colors.muted, fontSize: 13, margin: '12px 0 0' }}>No matching operational records.</p>}

      {results.length > 0 && (
        <div style={{ display: 'grid', gap: 6, marginTop: 12 }}>
          {results.map((result) => (
            <div key={`${result.entityType}:${result.entityId}`} style={{ padding: '11px 10px', border: `1px solid ${colors.border}`, borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Badge>{labels[result.entityType] ?? result.entityType}</Badge>
                    <strong style={{ fontSize: 13 }}>{result.title}</strong>
                  </div>
                  <div style={{ marginTop: 5, color: colors.muted, fontSize: 12, fontFamily: fonts.mono, overflowWrap: 'anywhere' }}>{result.entityId}</div>
                  <p style={{ margin: '5px 0 0', color: colors.muted, fontSize: 12 }}>{result.summary}</p>
                </div>
                {result.status && <Badge tone="default">{result.status}</Badge>}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
