'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge, Card, colors, fonts, radii } from '@umer/ui';
import type { WorkforceSnapshot } from '@/lib/workforce-api';

const departments = ['Executive Control', 'Intelligence', 'Revenue'];

async function loadWorkforce(): Promise<WorkforceSnapshot> {
  const response = await fetch('/api/workforce', { cache: 'no-store' });
  if (!response.ok) throw new Error(`Workforce snapshot failed: ${response.status}`);
  return response.json() as Promise<WorkforceSnapshot>;
}

function tone(status: string): 'success' | 'warning' | 'danger' | 'default' {
  if (status === 'RUNNING') return 'success';
  if (status === 'BLOCKED' || status === 'WAITING') return 'warning';
  if (status === 'FAILED') return 'danger';
  return 'default';
}

export function AIWorkforceCommandCenter() {
  const [snapshot, setSnapshot] = useState<WorkforceSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      try {
        const next = await loadWorkforce();
        if (mounted) { setSnapshot(next); setError(null); }
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : String(err));
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 2000);
    return () => { mounted = false; clearInterval(timer); };
  }, []);

  const query = search.trim().toLowerCase();
  const matchesAgent = (agent: WorkforceSnapshot['agents'][number]) => {
    if (!query) return true;
    return [agent.name, agent.agentId, agent.department, agent.role, agent.status, agent.currentTask,
      agent.currentProject, agent.currentBusiness, agent.currentRunId, agent.assignment?.task,
      agent.assignment?.projectName, agent.assignment?.nicheId, agent.assignment?.businessName,
      agent.assignment?.nextAction].filter(Boolean).join(' ').toLowerCase().includes(query);
  };
  const filteredAgents = useMemo(() => snapshot?.agents.filter(matchesAgent) ?? [], [snapshot, query]);
  const filteredEvents = useMemo(() => snapshot?.recentEvents.filter((event) => !query ||
    [event.agentName, event.eventType, event.stage, event.message, event.runId].filter(Boolean).join(' ').toLowerCase().includes(query)).slice(0, 20) ?? [], [snapshot, query]);

  return (
    <section style={{ display: 'grid', gap: 14, marginBottom: 28 }}>
      <Card title="AI Workforce Command Center">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 420px' }}>
            <p style={{ margin: 0, color: colors.muted, fontSize: 13, lineHeight: 1.5 }}>
              Persistent operational view of the AI workforce. Status, assignments, project context and heartbeats come from MySQL—not dashboard fixtures.
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <input aria-label="Search live workforce" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search agents, projects, businesses, tasks, runs, events..." style={{ flex: '1 1 360px', minWidth: 220, boxSizing: 'border-box', padding: '10px 12px', borderRadius: radii.sm, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.text, fontFamily: fonts.sans, outline: 'none' }} />
              <Link href="/guide" style={{ display: 'inline-flex', alignItems: 'center', padding: '0 12px', borderRadius: radii.sm, border: `1px solid ${colors.border}`, color: colors.text, textDecoration: 'none', fontSize: 12 }}>📖 Guide</Link>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            <Badge tone="success">{snapshot?.totals.RUNNING ?? 0} WORKING</Badge>
            <Badge>{snapshot?.totals.IDLE ?? 0} IDLE</Badge>
            <Badge tone="warning">{(snapshot?.totals.WAITING ?? 0) + (snapshot?.totals.BLOCKED ?? 0)} WAITING/BLOCKED</Badge>
            <Badge tone="danger">{snapshot?.totals.FAILED ?? 0} FAILED</Badge>
          </div>
        </div>
        {query ? <p style={{ margin: '10px 0 0', color: colors.muted, fontSize: 11 }}>Showing {filteredAgents.length} matching agents and {filteredEvents.length} matching events.</p> : null}
      </Card>

      {departments.map((department) => {
        const agents = filteredAgents.filter((agent) => agent.department === department);
        return (
          <Card key={department} title={`${department} · ${agents.length} agents`}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
              {agents.map((agent) => (
                <article key={agent.agentId} style={{ border: `1px solid ${colors.border}`, borderRadius: radii.md, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                    <strong style={{ fontSize: 14 }}>{agent.name}</strong>
                    <Badge tone={tone(agent.status)}>{agent.status}</Badge>
                  </div>
                  <div style={{ marginTop: 7, fontSize: 12, color: colors.muted }}>{agent.role}</div>
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${colors.border}` }}>
                    <div style={{ fontSize: 13 }}><strong>Task:</strong> {agent.currentTask ?? agent.assignment?.task ?? 'No active task'}</div>
                    <div style={{ marginTop: 6, fontSize: 12, color: colors.muted }}>Project: {agent.currentProject ?? agent.assignment?.projectName ?? '—'} · Niche: {agent.assignment?.nicheId ?? '—'}</div>
                    <div style={{ marginTop: 4, fontSize: 12, color: colors.muted }}>Business: {agent.currentBusiness ?? agent.assignment?.businessName ?? '—'}</div>
                    <div style={{ marginTop: 8, fontSize: 11, color: colors.muted }}>{agent.currentRunId ? `Run ${agent.currentRunId}` : 'No run'} · heartbeat {agent.lastHeartbeatAt ? new Date(agent.lastHeartbeatAt).toLocaleTimeString() : 'never'}</div>
                  </div>
                  {agent.assignment?.nextAction ? <div style={{ marginTop: 10, fontSize: 12, background: colors.accentSoft, borderRadius: radii.sm, padding: '8px 9px' }}><strong>Next:</strong> {agent.assignment.nextAction}</div> : null}
                </article>
              ))}
            </div>
            {agents.length === 0 ? <p style={{ margin: 0, color: colors.muted, fontSize: 12 }}>No matching agents in this department.</p> : null}
          </Card>
        );
      })}

      <Card title={query ? 'Matching agent event stream' : 'Persistent agent event stream'}>
        {filteredEvents.length ? (
          <div style={{ display: 'grid' }}>
            {filteredEvents.map((item) => (
              <div key={item.eventId} style={{ display: 'grid', gridTemplateColumns: '78px 145px 1fr', gap: 10, padding: '9px 0', borderBottom: `1px solid ${colors.border}` }}>
                <span style={{ color: colors.muted, fontSize: 11 }}>{new Date(item.occurredAt).toLocaleTimeString()}</span>
                <strong style={{ fontSize: 12 }}>{item.agentName}</strong>
                <span style={{ fontSize: 13 }}>{item.message}</span>
              </div>
            ))}
          </div>
        ) : <p style={{ margin: 0, color: colors.muted }}>{error ?? (query ? 'No matching live records.' : 'No persisted agent events yet. Start an intelligence run to populate the workforce stream.')}</p>}
      </Card>
    </section>
  );
}
