'use client';

import { useEffect, useState } from 'react';
import { Badge, Button, Card, colors, radii } from '@umer/ui';
import type { OpportunityRunStatus } from '@/lib/opportunity-engine';
import { OpportunityIntelligenceDetails } from '@/components/OpportunityIntelligenceDetails';

const stages = ['Discovery', 'Research', 'Audit', 'Problems', 'Scoring', 'Opportunities'];

async function getStatus(): Promise<OpportunityRunStatus> {
  const response = await fetch('/api/opportunity/status', { cache: 'no-store' });
  if (!response.ok) throw new Error(`Opportunity status failed: ${response.status}`);
  return response.json() as Promise<OpportunityRunStatus>;
}

async function runEngine(): Promise<void> {
  const response = await fetch('/api/opportunity/run', { method: 'POST' });
  if (!response.ok) throw new Error(`Opportunity run failed: ${response.status}`);
}

export function OpportunityControlCenter() {
  const [status, setStatus] = useState<OpportunityRunStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setStatus(await getStatus());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    void refresh();
    const ms = status?.running ? 2500 : 12000;
    const timer = setInterval(() => void refresh(), ms);
    return () => clearInterval(timer);
  }, [status?.running]);

  async function startRun() {
    setBusy(true);
    setError(null);
    try {
      await runEngine();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const activeStage = status?.stage ?? 'Idle';
  const activeIndex = stages.findIndex((stage) => stage.toLowerCase() === activeStage.toLowerCase());
  const progress = status?.progress ?? 0;

  return (
    <section style={{ display: 'grid', gap: 14 }}>
      <Card title="Market research">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Badge tone={status?.running ? 'success' : 'default'}>{status?.running ? 'RUNNING' : activeStage.toUpperCase()}</Badge>
              <Badge tone={status?.mode === 'LIVE_GOOGLE_PLACES' ? 'success' : 'warning'}>
                {status?.mode === 'LIVE_GOOGLE_PLACES' ? 'LIVE GOOGLE LISTINGS' : 'LOCAL FALLBACK'}
              </Badge>
              {status?.runId ? <code style={{ fontSize: 12 }}>{status.runId}</code> : null}
            </div>
            <h2 style={{ margin: '10px 0 4px', fontSize: 22 }}>Local operators — this market</h2>
            <p style={{ margin: 0, color: colors.muted, fontSize: 13, maxWidth: 520, lineHeight: 1.5 }}>
              Find listings, write down what is public, score work you might take. You still decide. New drafts do not invent conversion percentages.
            </p>
          </div>
          <Button onClick={() => void startRun()} disabled={busy || status?.running}>
            {busy ? 'Starting…' : status?.running ? 'Run in progress' : 'Run this market again'}
          </Button>
        </div>

        <div style={{ marginTop: 20, height: 7, borderRadius: radii.lg, background: colors.border, overflow: 'hidden' }}>
          <div style={{ width: `${progress}%`, height: '100%', background: colors.accent, transition: 'width 400ms ease' }} />
        </div>
        <div style={{ marginTop: 7, display: 'flex', justifyContent: 'space-between', color: colors.muted, fontSize: 12 }}>
          <span>{activeStage}</span><span>{progress}%</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginTop: 18 }}>
          {stages.map((stage, index) => {
            const complete = activeIndex > index || (!status?.running && status?.completedStages?.includes(stage));
            const active = activeIndex === index && status?.running;
            return (
              <div key={stage} style={{ padding: '12px 10px', border: `1px solid ${active ? colors.borderStrong : colors.border}`, borderRadius: radii.md, background: active ? colors.accentSoft : 'transparent' }}>
                <div style={{ fontSize: 11, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{complete ? '✓ Complete' : active ? '● Active' : '○ Waiting'}</div>
                <strong style={{ display: 'block', marginTop: 5, fontSize: 13 }}>{stage}</strong>
              </div>
            );
          })}
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
        {[
          ['Businesses', status?.metrics.businessesDiscovered ?? 0],
          ['Researched', status?.metrics.businessesResearched ?? 0],
          ['Problems', status?.metrics.problemsDetected ?? 0],
          ['Opportunities', status?.metrics.opportunitiesFound ?? 0],
          ['High value', status?.metrics.highValueOpportunities ?? 0],
          ['Pipeline value', `$${(status?.metrics.estimatedPipeline ?? 0).toLocaleString()}`],
        ].map(([label, value]) => (
          <Card key={String(label)} title={String(label)}><strong style={{ fontSize: 30, letterSpacing: '-0.04em' }}>{value}</strong></Card>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(280px, 0.65fr)', gap: 14 }}>
        <Card title="Live agent activity">
          {status?.events?.length ? (
            <div style={{ display: 'grid', gap: 0 }}>
              {status.events.slice(-20).reverse().map((item, index) => (
                <div key={`${item.at}-${index}`} style={{ display: 'grid', gridTemplateColumns: '72px 1fr', gap: 10, padding: '10px 0', borderBottom: `1px solid ${colors.border}` }}>
                  <span style={{ color: colors.muted, fontSize: 11, fontFamily: 'monospace' }}>{new Date(item.at).toLocaleTimeString()}</span>
                  <div><strong style={{ fontSize: 12 }}>{item.agent}</strong><div style={{ fontSize: 13, marginTop: 2 }}>{item.message}</div></div>
                </div>
              ))}
            </div>
          ) : <p style={{ margin: 0, color: colors.muted }}>No active run. Start the engine to see real events.</p>}
        </Card>

        <Card title="Current agents">
          <div style={{ display: 'grid', gap: 10 }}>
            {(status?.agents ?? []).map((agent) => (
              <div key={agent.name} style={{ padding: '11px 12px', border: `1px solid ${colors.border}`, borderRadius: radii.md }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><strong style={{ fontSize: 13 }}>{agent.name}</strong><Badge tone={agent.status === 'RUNNING' ? 'success' : 'default'}>{agent.status}</Badge></div>
                <p style={{ margin: '5px 0 0', fontSize: 12, color: colors.muted }}>{agent.task}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <OpportunityIntelligenceDetails runId={status?.runId ?? null} />

      {error ? <p style={{ color: colors.danger, margin: 0, fontSize: 13 }}>{error}</p> : null}
    </section>
  );
}
