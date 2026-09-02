'use client';

import { useEffect, useState } from 'react';
import { Badge, Card, colors, radii } from '@umer/ui';

type State = { servers: Array<Record<string, unknown>>; tools: Array<Record<string, unknown>>; permissions: Array<Record<string, unknown>>; usage: Array<Record<string, unknown>> };
async function load(): Promise<State> { const r = await fetch('/api/mcp', { cache: 'no-store' }); if (!r.ok) throw new Error(`MCP state failed: ${r.status}`); return r.json() as Promise<State>; }

export function MCPControlCenter() {
  const [state, setState] = useState<State | null>(null); const [error, setError] = useState<string | null>(null);
  useEffect(() => { let mounted = true; const refresh = async () => { try { const value = await load(); if (mounted) { setState(value); setError(null); } } catch (e) { if (mounted) setError(e instanceof Error ? e.message : String(e)); } }; void refresh(); const t = setInterval(() => void refresh(), 5000); return () => { mounted = false; clearInterval(t); }; }, []);
  return <Card title="MCP Control Center">
    <p style={{ margin: '0 0 12px', color: colors.muted, fontSize: 12 }}>Registered servers, tool risk, permissions, health and 24h usage. Calls are denied by default unless an agent has an explicit allow rule.</p>
    {error ? <p style={{ color: colors.danger, fontSize: 12 }}>{error}</p> : null}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 8 }}>
      {(state?.servers ?? []).map(s => <div key={String(s.server_id)} style={{ border: `1px solid ${colors.border}`, borderRadius: radii.md, padding: 11 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}><strong style={{ fontSize: 12 }}>{String(s.name)}</strong><Badge tone={String(s.status) === 'HEALTHY' ? 'success' : 'warning'}>{String(s.status)}</Badge></div><div style={{ marginTop: 5, fontSize: 10, color: colors.muted }}>{String(s.transport)} · trust {String(s.trust_level)}</div><div style={{ marginTop: 4, fontSize: 10, color: colors.muted }}>{String(s.endpoint ?? 'local')}</div></div>)}
    </div>
    <div style={{ marginTop: 16 }}><strong style={{ fontSize: 12 }}>Tool catalog & usage</strong>{(state?.tools ?? []).slice(0, 30).map(t => { const usage = (state?.usage ?? []).find(u => String(u.tool_name) === String(t.name)); return <div key={String(t.tool_id)} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto auto auto', gap: 8, alignItems: 'center', borderBottom: `1px solid ${colors.border}`, padding: '8px 2px' }}><div><strong style={{ fontSize: 11 }}>{String(t.name)}</strong><div style={{ color: colors.muted, fontSize: 10 }}>{String(t.server_name)} · risk {String(t.risk_level)} · {t.read_only ? 'read-only' : 'write'}</div></div><Badge tone={t.enabled ? 'success' : 'danger'}>{t.enabled ? 'enabled' : 'disabled'}</Badge><div style={{ fontSize: 10, color: colors.muted }}>{String(usage?.calls ?? 0)} calls</div><div style={{ fontSize: 10, color: colors.muted }}>{usage ? `${Number(usage.avg_latency_ms ?? 0).toFixed(0)}ms` : '—'}</div></div>; })}</div>
    <div style={{ marginTop: 16 }}><strong style={{ fontSize: 12 }}>Permission policy</strong>{(state?.permissions ?? []).slice(0, 20).map(p => <div key={String(p.permission_id)} style={{ padding: '7px 2px', borderBottom: `1px solid ${colors.border}`, fontSize: 10 }}><Badge tone={p.allowed ? 'success' : 'danger'}>{p.allowed ? 'ALLOW' : 'DENY'}</Badge> · {String(p.tool_name)} → {String(p.subject_type)}/{String(p.subject_id)}{p.max_calls_per_hour != null ? ` · ${String(p.max_calls_per_hour)}/hour` : ''}</div>)}</div>
  </Card>;
}
