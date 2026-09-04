import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Card, colors, fonts } from '@umer/ui';
import { getAgent, getAgentRun } from '@/lib/control-api';
import { StatusBadge } from '@/components/os/StatusBadge';
import { runActionTone } from '@/components/os/status';
import { formatRelativeTime } from '@/components/os/format';
import { TechnicalDetailsDrawer } from '@/components/os/TechnicalDetailsDrawer';

export const dynamic = 'force-dynamic';

export default async function AgentRunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await getAgentRun(id);
  if (!run) notFound();

  const agent = run.agentId ? await getAgent(run.agentId) : null;
  const tone = runActionTone(run.status, run.currentAction);
  const label = agent?.name ?? run.agentId ?? run.workPackageId;
  const reasons = run.decisions.map((d) => d.reason).filter((r): r is string => Boolean(r));

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <header>
        <Link href="/agent-runs" style={{ fontSize: 12, color: colors.muted, textDecoration: 'none' }}>
          ← Agent Work
        </Link>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
            marginTop: 8,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h1 style={{ fontSize: 'clamp(1.4rem, 2.4vw, 1.9rem)', fontWeight: 650, margin: 0, letterSpacing: '-0.03em' }}>
              {label}
            </h1>
            {run.summary ? <p style={{ margin: '4px 0 0', color: colors.muted, fontSize: 13 }}>{run.summary}</p> : null}
          </div>
          <StatusBadge tone={tone} />
        </div>
      </header>

      <Card title="Live Execution">
        {run.actionLog.length === 0 ? (
          <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>No activity recorded for this run yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: 2 }}>
            {run.actionLog.map((entry, idx) => (
              <div
                key={`${entry.at}-${idx}`}
                style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderBottom: `1px solid ${colors.border}` }}
              >
                <span style={{ color: colors.success, fontSize: 13, flexShrink: 0 }} aria-hidden>
                  ✓
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13 }}>{entry.summary}</div>
                  <div style={{ fontSize: 11, color: colors.muted, fontFamily: fonts.mono }}>{formatRelativeTime(entry.at)}</div>
                </div>
              </div>
            ))}
            {run.status === 'running' ? (
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0' }}>
                <span style={{ color: colors.warning, fontSize: 13, flexShrink: 0 }} aria-hidden>
                  ●
                </span>
                <div style={{ fontSize: 13, color: colors.text }}>
                  {run.currentTool ? `Using tool "${run.currentTool}"` : 'Waiting on the model'}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </Card>

      {reasons.length > 0 ? (
        <Card title="Why">
          <div style={{ display: 'grid', gap: 8 }}>
            {reasons.map((reason, idx) => (
              <p key={idx} style={{ margin: 0, fontSize: 13, color: colors.text }}>
                {reason}
              </p>
            ))}
          </div>
        </Card>
      ) : null}

      <Card title="Failures">
        {run.failures.length === 0 ? (
          <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>0 — nothing has failed in this run.</p>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {run.failures.map((f, idx) => (
              <p key={idx} style={{ margin: 0, fontSize: 13, color: colors.danger }}>
                {f.source}: {f.message}
              </p>
            ))}
          </div>
        )}
      </Card>

      <TechnicalDetailsDrawer
        data={{
          workPackageId: run.workPackageId,
          runId: run.runId,
          execId: run.execId,
          correlationId: run.correlationId,
          toolCalls: run.toolCalls,
          artifactId: run.artifactId,
        }}
      />
    </div>
  );
}
