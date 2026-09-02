'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge, Card, colors, fonts, radii } from '@umer/ui';

type TimelineEvent = {
  eventId: string;
  source: string;
  eventType: string;
  occurredAt: string;
  level: string;
  message: string;
  taskId: string | null;
  agentId: string | null;
  runId: string | null;
  projectId: string | null;
  entityType: string | null;
  entityId: string | null;
  metadata: unknown;
};

type TimelineResponse = { events: TimelineEvent[]; generatedAt: string };

const sourceTone = (source: string): 'success' | 'warning' | 'danger' | 'default' => {
  if (source === 'kernel') return 'success';
  if (source === 'opportunity') return 'warning';
  if (source === 'workforce') return 'default';
  return 'default';
};

export function CrossSystemTimeline() {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [agentId, setAgentId] = useState('');
  const [runId, setRunId] = useState('');
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const params = new URLSearchParams({ limit: '100' });
        if (agentId.trim()) params.set('agentId', agentId.trim());
        if (runId.trim()) params.set('runId', runId.trim());
        if (q.trim()) params.set('q', q.trim());
        const response = await fetch(`/api/timeline?${params.toString()}`, { cache: 'no-store' });
        if (!response.ok) throw new Error(`Timeline failed: ${response.status}`);
        const data = await response.json() as TimelineResponse;
        if (mounted) { setEvents(data.events); setGeneratedAt(data.generatedAt); setError(null); }
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : String(err));
      }
    };
    void load();
    const timer = setInterval(() => void load(), 4000);
    return () => { mounted = false; clearInterval(timer); };
  }, [agentId, runId, q]);

  return (
    <Card title="Unified Cross-System Timeline">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <input aria-label="Filter timeline by agent" value={agentId} onChange={(e) => setAgentId(e.target.value)} placeholder="Agent ID" style={{ flex: '1 1 150px', minWidth: 130, padding: '8px 10px', border: `1px solid ${colors.border}`, borderRadius: radii.sm, background: colors.bg, color: colors.text, fontSize: 12 }} />
        <input aria-label="Filter timeline by run" value={runId} onChange={(e) => setRunId(e.target.value)} placeholder="Run ID" style={{ flex: '1 1 180px', minWidth: 150, padding: '8px 10px', border: `1px solid ${colors.border}`, borderRadius: radii.sm, background: colors.bg, color: colors.text, fontSize: 12 }} />
        <input aria-label="Search timeline" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search events..." style={{ flex: '2 1 240px', minWidth: 180, padding: '8px 10px', border: `1px solid ${colors.border}`, borderRadius: radii.sm, background: colors.bg, color: colors.text, fontSize: 12 }} />
      </div>
      {error ? <p style={{ margin: '0 0 10px', color: colors.danger, fontSize: 12 }}>{error}</p> : null}
      {events.length === 0 ? <p style={{ margin: 0, color: colors.muted, fontSize: 12 }}>No correlated events yet.</p> : (
        <div style={{ display: 'grid', gap: 0 }}>
          {events.map((event) => (
            <article key={`${event.source}:${event.eventId}`} style={{ display: 'grid', gridTemplateColumns: '82px 105px minmax(0, 1fr)', gap: 10, padding: '11px 4px', borderBottom: `1px solid ${colors.border}` }}>
              <time dateTime={event.occurredAt} style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.muted }}>{new Date(event.occurredAt).toLocaleTimeString()}</time>
              <div><Badge tone={sourceTone(event.source)}>{event.source}</Badge><div style={{ marginTop: 4, fontSize: 10, color: colors.muted, overflowWrap: 'anywhere' }}>{event.eventType}</div></div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, lineHeight: 1.45 }}>{event.message}</div>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 5, fontSize: 10, color: colors.muted }}>
                  {event.agentId ? <span>agent: <strong>{event.agentId}</strong></span> : null}
                  {event.taskId ? <Link href={`/api/kernel/tasks/${encodeURIComponent(event.taskId)}`} style={{ color: colors.text }}>task: {event.taskId}</Link> : null}
                  {event.runId ? <span>run: <strong>{event.runId}</strong></span> : null}
                  {event.projectId ? <span>project: <strong>{event.projectId}</strong></span> : null}
                  {event.entityType && event.entityId ? <span>{event.entityType}: <strong>{event.entityId}</strong></span> : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {generatedAt ? <div style={{ marginTop: 9, fontSize: 10, color: colors.muted }}>Live read · updated {new Date(generatedAt).toLocaleTimeString()} · {events.length} events</div> : null}
    </Card>
  );
}
