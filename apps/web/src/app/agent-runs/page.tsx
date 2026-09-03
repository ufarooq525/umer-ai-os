import Link from 'next/link';
import { Card, colors, fonts, radii } from '@umer/ui';
import { getAgentRuns, getAgents } from '@/lib/control-api';
import { StatusBadge } from '@/components/os/StatusBadge';
import { formatRelativeTime } from '@/components/os/format';

export const dynamic = 'force-dynamic';

export default async function AgentRunsPage() {
  const [agentRuns, agents] = await Promise.all([getAgentRuns(), getAgents()]);
  const agentById = new Map(agents.map((a) => [a.agentId, a]));
  const sorted = [...agentRuns].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <header>
        <h1 style={{ fontSize: 'clamp(1.5rem, 2.6vw, 2rem)', fontWeight: 650, margin: 0, letterSpacing: '-0.03em' }}>
          Agent Runs ({agentRuns.length})
        </h1>
        <p style={{ margin: '8px 0 0', color: colors.muted, fontSize: 14 }}>
          Every tracked run of the Agent Runtime, from the Runtime Observability read model.
        </p>
      </header>

      {sorted.length === 0 ? (
        <Card>
          <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>
            No runs recorded yet — this read model is empty until the Message Fabric subscription observes a live run.
          </p>
        </Card>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {sorted.map((run) => {
            const agent = run.agentId ? agentById.get(run.agentId) : undefined;
            return (
              <Link
                key={run.workPackageId}
                href={run.agentId ? `/company/agents/${run.agentId}` : '/agent-runs'}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                  padding: 14,
                  borderRadius: radii.lg,
                  border: `1px solid ${colors.border}`,
                  background: colors.surface,
                  textDecoration: 'none',
                  color: colors.text,
                }}
              >
                <div>
                  <strong style={{ fontSize: 13 }}>{agent?.name ?? run.agentId ?? run.workPackageId}</strong>
                  <div style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.muted, marginTop: 2 }}>
                    {run.workPackageId} · {run.toolCalls.length} tool calls · updated {formatRelativeTime(run.updatedAt)}
                  </div>
                </div>
                <StatusBadge tone={run.status === 'completed' ? 'completed' : run.status === 'failed' ? 'failed' : 'working'} label={run.status} />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
