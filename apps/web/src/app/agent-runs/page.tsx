import Link from 'next/link';
import { Card, colors, fonts, radii } from '@umer/ui';
import { getAgentRuns, getAgents, getTasks, getWorkProjects } from '@/lib/control-api';
import { StatusBadge } from '@/components/os/StatusBadge';
import { runActionTone } from '@/components/os/status';
import { formatRelativeTime } from '@/components/os/format';
import { agentCurrentTask, agentProjectName } from '@/components/os/joins';

export const dynamic = 'force-dynamic';

const EXAMPLE_STEPS = [
  'Opportunity discovered',
  'Agent started research',
  'Prospect identified',
  'Evidence collected',
  'Decision requested',
  'Project created',
];

export default async function AgentWorkPage() {
  const [agentRuns, agents, tasks, projects] = await Promise.all([getAgentRuns(), getAgents(), getTasks(), getWorkProjects()]);
  const agentById = new Map(agents.map((a) => [a.agentId, a]));
  const sorted = [...agentRuns].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <header>
        <h1 style={{ fontSize: 'clamp(1.5rem, 2.6vw, 2rem)', fontWeight: 650, margin: 0, letterSpacing: '-0.03em' }}>
          Agent Work {sorted.length > 0 ? `(${sorted.length})` : ''}
        </h1>
        <p style={{ margin: '8px 0 0', color: colors.muted, fontSize: 14 }}>What every agent is doing, or has just done.</p>
      </header>

      {sorted.length === 0 ? (
        <Card>
          <p style={{ margin: '0 0 12px', color: colors.text, fontSize: 14, lineHeight: 1.6 }}>
            No agent work is happening right now. This view fills in as soon as an agent picks up a task.
          </p>
          <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.muted }}>
            Your first activity will look like
          </p>
          <div style={{ display: 'grid', gap: 4, opacity: 0.55 }}>
            {EXAMPLE_STEPS.map((step) => (
              <div key={step} style={{ fontSize: 13, color: colors.muted, fontStyle: 'italic' }}>
                ● {step}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14 }}>
            <Link href="/company/agents" style={{ fontSize: 12, color: colors.accent, marginRight: 16 }}>
              View Agents →
            </Link>
            <Link href="/company/opportunities" style={{ fontSize: 12, color: colors.accent }}>
              View Opportunities →
            </Link>
          </div>
        </Card>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {sorted.map((run) => {
            const agent = run.agentId ? agentById.get(run.agentId) : undefined;
            const task = agent ? agentCurrentTask(agent, tasks) : undefined;
            const project = agent ? agentProjectName(agent, tasks, projects) : undefined;
            return (
              <Link
                key={run.workPackageId}
                href={`/agent-runs/${run.workPackageId}`}
                style={{
                  display: 'block',
                  padding: 14,
                  borderRadius: radii.lg,
                  border: `1px solid ${colors.border}`,
                  background: colors.surface,
                  textDecoration: 'none',
                  color: colors.text,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: 14 }}>{agent?.name ?? run.agentId ?? run.workPackageId}</strong>
                  <StatusBadge tone={runActionTone(run.status, run.currentAction)} label={run.status === 'running' ? undefined : run.status.toUpperCase()} />
                </div>
                <div style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>
                  {task?.title ?? run.summary ?? 'Working'}
                  {project ? ` · ${project}` : ''}
                </div>
                <div style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.muted, marginTop: 6 }}>
                  {run.toolCalls.length} action{run.toolCalls.length === 1 ? '' : 's'} completed · updated {formatRelativeTime(run.updatedAt)}
                  {run.failures.length > 0 ? ` · ${run.failures.length} failure${run.failures.length === 1 ? '' : 's'}` : ''}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
