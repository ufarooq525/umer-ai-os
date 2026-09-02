'use client';

import { useEffect, useState } from 'react';
import { Badge, Card, colors, fonts } from '@umer/ui';

type Snapshot = {
  recoveredTasks: number;
  staleAgents: string[];
  heartbeatTimeoutSeconds: number;
  queueDepth: number;
  activeTaskCount: number;
  activeLeaseCount: number;
  agents: Array<{ agentId: string; name: string; status: string; lastHeartbeatAt: string | null; currentTask: string | null; currentRunId: string | null }>;
  recentEvents: Array<{ event_id: string; event_type: string; agent_id: string | null; severity: string; message: string; occurred_at: string }>;
};

export function WorkerSupervisor() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const response = await fetch('/api/supervisor', { cache: 'no-store' });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? 'Supervisor unavailable');
        if (alive) { setData(payload); setError(null); }
      } catch (e) { if (alive) setError(e instanceof Error ? e.message : 'Supervisor unavailable'); }
    };
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => { alive = false; window.clearInterval(timer); };
  }, []);

  return <section style={{ marginTop: 18 }}>
    <Card title="Worker Supervisor">
      <p style={{ margin: '0 0 14px', color: colors.muted, fontSize: 13 }}>Reconciles leases, detects stale workers and keeps the durable queue honest.</p>
      {error ? <p style={{ color: colors.danger }}>{error}</p> : !data ? <p style={{ color: colors.muted }}>Loading supervisor…</p> : <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
          {[[data.queueDepth, 'Queued'], [data.activeTaskCount, 'Active tasks'], [data.activeLeaseCount, 'Active leases'], [data.recoveredTasks, 'Recovered'], [data.staleAgents.length, 'Stale workers']].map(([value, label]) => <div key={label as string} style={{ border: `1px solid ${colors.border}`, borderRadius: 10, padding: 12 }}><strong style={{ display: 'block', fontSize: 22 }}>{value}</strong><span style={{ color: colors.muted, fontSize: 11 }}>{label}</span></div>)}
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {data.agents.map((agent) => <div key={agent.agentId} style={{ display: 'grid', gridTemplateColumns: '1.2fr .7fr 1.5fr', gap: 10, alignItems: 'center', padding: '9px 0', borderBottom: `1px solid ${colors.border}` }}><div><strong>{agent.name}</strong><div style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.muted }}>{agent.agentId}</div></div><Badge tone={agent.status === 'STALE' ? 'warning' : agent.status === 'RUNNING' ? 'success' : 'default'}>{agent.status}</Badge><div style={{ fontSize: 12, color: colors.muted }}>{agent.currentTask ?? 'No current task'}{agent.currentRunId ? ` · ${agent.currentRunId}` : ''}</div></div>)}
        </div>
        <details style={{ marginTop: 14 }}><summary style={{ cursor: 'pointer', fontSize: 12 }}>Supervisor event stream</summary><div style={{ marginTop: 8, display: 'grid', gap: 5 }}>{data.recentEvents.map((event) => <div key={event.event_id} style={{ fontSize: 11, color: colors.muted }}><strong>{event.event_type}</strong> · {event.agent_id ?? 'system'} · {event.message}</div>)}</div></details>
      </>}
    </Card>
  </section>;
}
