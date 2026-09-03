import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Badge, Card, colors, fonts } from '@umer/ui';
import { getAgent, getAgentRuns, getTasks, getWorkProjects, type AgentRunRecord } from '@/lib/control-api';
import { EntityNarrative, type NarrativeField } from '@/components/os/EntityNarrative';
import { StatusBadge } from '@/components/os/StatusBadge';
import { agentTone, runActionTone } from '@/components/os/status';
import { agentCurrentRun, agentCurrentTask, agentProjectName } from '@/components/os/joins';
import { formatRelativeTime, humanizeSpecialistId } from '@/components/os/format';
import { TechnicalDetailsDrawer } from '@/components/os/TechnicalDetailsDrawer';

export const dynamic = 'force-dynamic';

export default async function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agent = await getAgent(id);
  if (!agent) notFound();

  const [tasks, projects, agentRuns] = await Promise.all([getTasks(), getWorkProjects(), getAgentRuns()]);
  const run = agentCurrentRun(agent, agentRuns);
  const currentTask = agentCurrentTask(agent, tasks);
  const projectName = agentProjectName(agent, tasks, projects);
  const recentRuns = agentRuns.filter((r) => r.agentId === agent.agentId).slice(0, 5);

  const fields: NarrativeField[] = [
    ...(projectName ? [{ key: 'WHY' as const, value: `Working within "${projectName}".` }] : []),
    {
      key: 'NOW',
      value:
        run?.status === 'running'
          ? run.currentTool
            ? `Using tool "${run.currentTool}".`
            : 'Waiting on a model response.'
          : currentTask
            ? currentTask.title
            : agent.controlState === 'paused'
              ? `Paused by CEO${agent.controlReason ? ` — ${agent.controlReason}` : ''}.`
              : 'No active work.',
    },
    ...(run?.summary ? [{ key: 'RESULT' as const, value: run.summary }] : []),
    {
      key: 'PROBLEM',
      value: run && run.failures.length > 0 ? run.failures[run.failures.length - 1]!.message : 'None',
    },
  ];

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <header>
        <Link href="/company/agents" style={{ fontSize: 12, color: colors.muted, textDecoration: 'none' }}>
          ← Agents
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 'clamp(1.4rem, 2.4vw, 1.9rem)', fontWeight: 650, margin: 0, letterSpacing: '-0.03em' }}>
              {agent.name ?? agent.agentId}
            </h1>
            <p style={{ margin: '4px 0 0', color: colors.muted, fontSize: 13, fontFamily: fonts.mono }}>
              {agent.specialistId} · {agent.department ?? humanizeSpecialistId(agent.specialistId)}
            </p>
          </div>
          <StatusBadge tone={run && run.status === 'running' ? runActionTone(run.status, run.currentAction) : agentTone(agent.status, agent.controlState)} />
        </div>
        {agent.capabilityIds && agent.capabilityIds.length > 0 ? (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            {agent.capabilityIds.map((cap) => (
              <Badge key={cap}>{cap}</Badge>
            ))}
          </div>
        ) : null}
      </header>

      <EntityNarrative fields={fields} />

      <Card title="Identity &amp; state">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, fontSize: 13 }}>
          <Field label="Project" value={projectName ?? '—'} />
          <Field label="Task" value={currentTask?.title ?? '—'} />
          <Field label="Work package" value={agent.currentWorkPackageId ?? '—'} mono />
          <Field label="Run" value={run?.workPackageId ?? '—'} mono />
          <Field label="Control state" value={agent.controlState} />
          <Field label="Last seen" value={formatRelativeTime(agent.lastSeenAt)} />
        </div>
      </Card>

      {run ? (
        <Card title="Current run timeline">
          <RunTimeline run={run} />
        </Card>
      ) : null}

      {recentRuns.length > 0 ? (
        <Card title="Recent runs">
          <div style={{ display: 'grid', gap: 6 }}>
            {recentRuns.map((r) => (
              <div key={r.workPackageId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '6px 0', borderBottom: `1px solid ${colors.border}` }}>
                <span style={{ fontFamily: fonts.mono, color: colors.muted }}>{r.workPackageId}</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ color: colors.muted }}>{r.toolCalls.length} tool calls</span>
                  <StatusBadge tone={r.status === 'completed' ? 'completed' : r.status === 'failed' ? 'failed' : 'working'} label={r.status} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: colors.muted, marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontFamily: mono ? fonts.mono : fonts.sans, fontSize: 13 }}>{value}</div>
    </div>
  );
}

function RunTimeline({ run }: { run: AgentRunRecord }) {
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      {run.actionLog.map((entry, idx) => (
        <div key={`${entry.at}-${idx}`} style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 10, fontSize: 12, padding: '6px 0', borderBottom: `1px solid ${colors.border}` }}>
          <span style={{ fontFamily: fonts.mono, color: colors.muted }}>{formatRelativeTime(entry.at)}</span>
          <span>{entry.summary}</span>
        </div>
      ))}
      {run.actionLog.length === 0 ? <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>No activity recorded yet.</p> : null}
      <div style={{ marginTop: 6 }}>
        <TechnicalDetailsDrawer
          data={{
            runId: run.runId,
            execId: run.execId,
            correlationId: run.correlationId,
            toolCalls: run.toolCalls,
            decisions: run.decisions,
            failures: run.failures,
            artifactId: run.artifactId,
          }}
        />
      </div>
    </div>
  );
}
