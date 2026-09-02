'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge, Card, colors, fonts, radii } from '@umer/ui';
import type { WorkforceSnapshot } from '@/lib/workforce-api';

const departments = ['Executive Control', 'Intelligence', 'Revenue'];

type KernelOperations = {
  generatedAt: string;
  taskCounts: Record<string, number>;
  tasks: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
  economics24h: {
    inputTokens: number;
    outputTokens: number;
    cachedTokens: number;
    totalTokens: number;
    cacheRate: number;
    modelCost: number;
    toolCalls: number;
    toolCacheHits: number;
    toolCacheRate: number;
    toolFailures: number;
    toolCost: number;
    evaluations: number;
    passedEvaluations: number;
    averageScore: number;
    averageConfidence: number;
    totalTrackedCost: number;
  };
  costsByCategory: Array<{ category: string; amount: number }>;
};

async function loadWorkforce(): Promise<WorkforceSnapshot> {
  const response = await fetch('/api/workforce', { cache: 'no-store' });
  if (!response.ok) throw new Error(`Workforce snapshot failed: ${response.status}`);
  return response.json() as Promise<WorkforceSnapshot>;
}

async function loadKernel(): Promise<KernelOperations> {
  const response = await fetch('/api/kernel/operations', { cache: 'no-store' });
  if (!response.ok) throw new Error(`Kernel operations failed: ${response.status}`);
  return response.json() as Promise<KernelOperations>;
}

function tone(status: string): 'success' | 'warning' | 'danger' | 'default' {
  if (status === 'RUNNING' || status === 'WORKING') return 'success';
  if (status === 'BLOCKED' || status === 'WAITING' || status === 'QUEUED') return 'warning';
  if (status === 'FAILED') return 'danger';
  return 'default';
}

function number(value: unknown) {
  return Number(value ?? 0).toLocaleString();
}

function money(value: number) {
  return `$${value.toFixed(4)}`;
}

export function AIWorkforceCommandCenter() {
  const [snapshot, setSnapshot] = useState<WorkforceSnapshot | null>(null);
  const [kernel, setKernel] = useState<KernelOperations | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      try {
        const [workforce, operations] = await Promise.all([loadWorkforce(), loadKernel()]);
        if (mounted) { setSnapshot(workforce); setKernel(operations); setError(null); }
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : String(err));
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 3000);
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
  const filteredTasks = useMemo(() => kernel?.tasks.filter((task) => !query || Object.values(task).filter(Boolean).join(' ').toLowerCase().includes(query)).slice(0, 30) ?? [], [kernel, query]);
  const e = kernel?.economics24h;

  return (
    <section style={{ display: 'grid', gap: 14, marginBottom: 28 }}>
      <Card title="AI Workforce Command Center">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 420px' }}>
            <p style={{ margin: 0, color: colors.muted, fontSize: 13, lineHeight: 1.5 }}>
              CEO-level operational truth: workforce state, durable tasks, execution events and AI economics are read from MySQL.
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <input aria-label="Search AI OS" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search agents, tasks, projects, businesses, runs, events..." style={{ flex: '1 1 360px', minWidth: 220, boxSizing: 'border-box', padding: '10px 12px', borderRadius: radii.sm, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.text, fontFamily: fonts.sans, outline: 'none' }} />
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
        {query ? <p style={{ margin: '10px 0 0', color: colors.muted, fontSize: 11 }}>Showing {filteredAgents.length} agents, {filteredTasks.length} tasks and {filteredEvents.length} workforce events.</p> : null}
        {error ? <p style={{ margin: '10px 0 0', color: colors.danger, fontSize: 12 }}>{error}</p> : null}
      </Card>

      <Card title="Kernel Operations · 24h AI Economics">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 9 }}>
          {[
            ['Queued', number(kernel?.taskCounts.QUEUED)],
            ['Running', number(kernel?.taskCounts.RUNNING)],
            ['Completed', number(kernel?.taskCounts.COMPLETED)],
            ['Failed', number(kernel?.taskCounts.FAILED)],
            ['Tokens', number(e?.totalTokens)],
            ['Cached', `${(e?.cacheRate ?? 0) * 100 | 0}%`],
            ['Tool calls', number(e?.toolCalls)],
            ['Tool failures', number(e?.toolFailures)],
            ['Eval score', `${(e?.averageScore ?? 0).toFixed(1)}`],
            ['Tracked cost', money(e?.totalTrackedCost ?? 0)],
          ].map(([label, value]) => (
            <div key={label} style={{ border: `1px solid ${colors.border}`, borderRadius: radii.md, padding: 12 }}>
              <div style={{ fontSize: 11, color: colors.muted }}>{label}</div>
              <div style={{ marginTop: 5, fontSize: 20, fontWeight: 700 }}>{value}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: colors.muted }}>
          Input {number(e?.inputTokens)} · Output {number(e?.outputTokens)} · Cached {number(e?.cachedTokens)} · Model {money(e?.modelCost ?? 0)} · Tools {money(e?.toolCost ?? 0)} · Eval pass {number(e?.passedEvaluations)}/{number(e?.evaluations)}
        </div>
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

      <Card title={query ? 'Task Explorer · matching tasks' : 'Task Explorer · latest durable work'}>
        {filteredTasks.length ? (
          <div style={{ display: 'grid' }}>
            {filteredTasks.map((task) => {
              const status = String(task.status ?? 'UNKNOWN');
              return (
                <div key={String(task.task_id)} style={{ display: 'grid', gridTemplateColumns: '86px minmax(180px, 1fr) 110px 140px 100px', gap: 10, alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${colors.border}` }}>
                  <Badge tone={tone(status)}>{status}</Badge>
                  <div><strong style={{ fontSize: 13 }}>{String(task.title ?? 'Untitled task')}</strong><div style={{ fontSize: 10, color: colors.muted }}>{String(task.task_type ?? '—')} · run {String(task.run_id ?? '—')}</div></div>
                  <div style={{ fontSize: 11, color: colors.muted }}>Agent<br /><strong style={{ color: colors.text }}>{String(task.assigned_agent_id ?? 'unassigned')}</strong></div>
                  <div style={{ fontSize: 11, color: colors.muted }}>Attempts {number(task.attempts)}/{number(task.max_attempts)}<br />Priority {number(task.priority)}</div>
                  <div style={{ fontSize: 11, color: colors.muted }}>{task.completed_at ? new Date(String(task.completed_at)).toLocaleTimeString() : task.started_at ? 'running' : 'queued'}</div>
                </div>
              );
            })}
          </div>
        ) : <p style={{ margin: 0, color: colors.muted }}>No durable kernel tasks yet.</p>}
      </Card>

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
        ) : <p style={{ margin: 0, color: colors.muted }}>{query ? 'No matching live records.' : 'No persisted agent events yet. Start an intelligence run to populate the workforce stream.'}</p>}
      </Card>

      <Card title="Kernel event timeline">
        {kernel?.events.length ? (
          <div style={{ display: 'grid' }}>
            {kernel.events.slice(0, 25).map((event) => (
              <div key={String(event.event_id)} style={{ display: 'grid', gridTemplateColumns: '78px 150px 1fr', gap: 10, padding: '8px 0', borderBottom: `1px solid ${colors.border}` }}>
                <span style={{ color: colors.muted, fontSize: 11 }}>{new Date(String(event.occurred_at)).toLocaleTimeString()}</span>
                <span style={{ fontSize: 11 }}><strong>{String(event.event_type)}</strong><br />{String(event.agent_id ?? 'system')}</span>
                <span style={{ fontSize: 12 }}>{String(event.message ?? '')}</span>
              </div>
            ))}
          </div>
        ) : <p style={{ margin: 0, color: colors.muted }}>No kernel events yet.</p>}
      </Card>
    </section>
  );
}
