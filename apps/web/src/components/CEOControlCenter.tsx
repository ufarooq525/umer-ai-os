'use client';

import { useEffect, useState } from 'react';
import { Badge, Card, colors, radii } from '@umer/ui';

type State = { agents: Array<Record<string, unknown>>; tasks: Array<Record<string, unknown>>; audit: Array<Record<string, unknown>> };

async function load(): Promise<State> { const r = await fetch('/api/control', { cache: 'no-store' }); if (!r.ok) throw new Error(`Control state failed: ${r.status}`); return r.json() as Promise<State>; }

export function CEOControlCenter() {
  const [state, setState] = useState<State | null>(null); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState<string | null>(null); const [reason, setReason] = useState(''); const [agentForTask, setAgentForTask] = useState('');
  const refresh = async () => { try { setState(await load()); setError(null); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } };
  useEffect(() => { void refresh(); const t = setInterval(() => void refresh(), 5000); return () => clearInterval(t); }, []);
  const control = async (action: string, targetId: string, agentId?: string) => { const key = `${action}:${targetId}`; setBusy(key); try { const r = await fetch('/api/control', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, targetId, agentId, reason: reason || undefined }) }); const data = await r.json(); if (!r.ok) throw new Error(data.error ?? 'Control action failed'); await refresh(); setReason(''); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(null); } };
  return <Card title="CEO Control Center">
    <p style={{ margin: '0 0 12px', color: colors.muted, fontSize: 12 }}>Direct operational controls. Every action is persisted with before/after state and appears in the workflow audit trail.</p>
    <input aria-label="Control reason" value={reason} onChange={e => setReason(e.target.value)} placeholder="Optional reason for the action..." style={{ width: '100%', boxSizing: 'border-box', padding: '9px 10px', border: `1px solid ${colors.border}`, borderRadius: radii.sm, background: colors.bg, color: colors.text, marginBottom: 12 }} />
    {error ? <p style={{ color: colors.danger, fontSize: 12 }}>{error}</p> : null}
    <div style={{ display: 'grid', gap: 10 }}>
      {(state?.agents ?? []).map(agent => { const id = String(agent.agent_id); const status = String(agent.status); const key = `pause_agent:${id}`; return <div key={id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', borderBottom: `1px solid ${colors.border}`, padding: '9px 2px' }}><div><strong>{String(agent.name)}</strong><div style={{ color: colors.muted, fontSize: 10 }}>{id} · {status}</div></div><button disabled={busy === key} onClick={() => void control(status === 'PAUSED' ? 'resume_agent' : 'pause_agent', id)} style={{ padding: '6px 10px', borderRadius: radii.sm, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.text }}>{busy === key ? 'Working…' : status === 'PAUSED' ? 'Resume' : 'Pause'}</button></div>; })}
    </div>
    <div style={{ marginTop: 18 }}><strong style={{ fontSize: 12 }}>Task controls</strong>{(state?.tasks ?? []).slice(0, 30).map(task => { const id = String(task.task_id); const status = String(task.status); const retryable = ['FAILED','BLOCKED','WAITING','CANCELLED'].includes(status); const key = `retry_task:${id}`; return <div key={id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto auto', gap: 8, alignItems: 'center', borderBottom: `1px solid ${colors.border}`, padding: '8px 2px' }}><div><div style={{ fontSize: 12 }}>{String(task.title ?? id)}</div><div style={{ color: colors.muted, fontSize: 10 }}>{id} · {status} · agent {String(task.assigned_agent_id ?? '—')}</div></div>{retryable ? <button disabled={busy === key} onClick={() => void control('retry_task', id)} style={{ padding: '5px 8px', border: `1px solid ${colors.border}`, borderRadius: radii.sm, background: colors.bg, color: colors.text }}>Retry</button> : null}{!['COMPLETED','CANCELLED'].includes(status) ? <button onClick={() => void control('cancel_task', id)} style={{ padding: '5px 8px', border: `1px solid ${colors.border}`, borderRadius: radii.sm, background: colors.bg, color: colors.text }}>Cancel</button> : <Badge>{status}</Badge>}</div>; })}</div>
    <div style={{ marginTop: 18 }}><strong style={{ fontSize: 12 }}>Control audit</strong>{(state?.audit ?? []).slice(0, 10).map(a => <div key={String(a.audit_id)} style={{ padding: '7px 2px', borderBottom: `1px solid ${colors.border}`, fontSize: 11 }}><strong>{String(a.action)}</strong> · {String(a.target_type)}/{String(a.target_id)} · {new Date(String(a.occurred_at)).toLocaleString()}<div style={{ color: colors.muted }}>{String(a.reason ?? 'No reason supplied')}</div></div>)}</div>
  </Card>;
}
