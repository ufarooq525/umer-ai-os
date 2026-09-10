import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Bot, ChevronRight } from 'lucide-react';
import { Badge, colors, fonts, radii } from '@umer/ui';
import { getAgent, getAgentRuns, getArtifacts, getTasks, getWorkProjects, type AgentRunRecord } from '@/lib/control-api';
import { StatusBadge } from '@/components/os/StatusBadge';
import { agentTone, runActionTone } from '@/components/os/status';
import { agentCurrentRun, agentCurrentTask, agentProjectName } from '@/components/os/joins';
import { formatRelativeTime, humanizeSpecialistId } from '@/components/os/format';
import { TechnicalDetailsDrawer } from '@/components/os/TechnicalDetailsDrawer';
import { CompanySubNav } from '@/components/os/CompanySubNav';
import { LocalGraphPanel } from '@/components/os/LocalGraphPanel';

export const dynamic = 'force-dynamic';

export default async function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agent = await getAgent(id);
  if (!agent) notFound();

  const [tasks, projects, agentRuns, allArtifacts] = await Promise.all([
    getTasks(),
    getWorkProjects(),
    getAgentRuns(),
    getArtifacts(),
  ]);

  const run = agentCurrentRun(agent, agentRuns);
  const currentTask = agentCurrentTask(agent, tasks);
  const projectName = agentProjectName(agent, tasks, projects);
  const recentRuns = agentRuns.filter((r) => r.agentId === agent.agentId || r.specialistId === agent.specialistId);
  const agentArtifacts = allArtifacts.filter(
    (a) => a.producedBy === agent.agentId || a.producedBy === agent.specialistId || (run?.artifactId && a.artifactId === run.artifactId)
  );

  const isWorking = agent.status === 'active' && agent.controlState === 'active';
  const roleName = agent.department ?? humanizeSpecialistId(agent.specialistId);
  const wpId = agent.currentWorkPackageId || run?.workPackageId;
  const objective = currentTask?.title || (run?.currentTool ? `Execute ${run.currentTool}` : 'Autonomous specialist execution');
  const targetOutput = run?.artifactId ? `Artifact ${run.artifactId}` : `${roleName} Spec`;

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {/* Header & Sub-navigation */}
      <div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 12 }}>
          <Link href="/company/agents" style={{ fontSize: 12.5, color: colors.muted, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
            ← All Agents
          </Link>
          <span style={{ color: 'rgba(255, 255, 255, 0.2)' }}>/</span>
          <Link
            href={`/company/graph?agentId=${encodeURIComponent(agent.agentId)}`}
            style={{ fontSize: 12.5, color: colors.accent, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <span>⬡</span> View Agent in Company Graph
          </Link>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: isWorking ? 'rgba(167, 139, 250, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                color: isWorking ? '#a78bfa' : colors.muted,
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <Bot size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h1 style={{ fontSize: 'clamp(1.5rem, 2.6vw, 2.2rem)', fontWeight: 650, margin: 0, letterSpacing: '-0.03em', color: '#ffffff' }}>
                  {agent.name ?? agent.agentId}
                </h1>
                <StatusBadge tone={run && run.status === 'running' ? runActionTone(run.status, run.currentAction) : agentTone(agent.status, agent.controlState)} />
              </div>
              <p style={{ margin: '4px 0 0', color: colors.muted, fontSize: 13, fontFamily: fonts.mono }}>
                {agent.specialistId} · {roleName}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 11.5, color: colors.muted, fontFamily: fonts.mono }}>
              Last seen: {formatRelativeTime(agent.lastSeenAt)}
            </span>
          </div>
        </div>

        {agent.capabilityIds && agent.capabilityIds.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
            {agent.capabilityIds.map((cap) => (
              <Badge key={cap}>{cap}</Badge>
            ))}
          </div>
        )}
      </div>

      <CompanySubNav />

      {/* CRITICAL RELATIONSHIP CHAIN: Agent → Work Package → Project → Objective → Output */}
      <section
        style={{
          borderRadius: 16,
          border: '1px solid rgba(232, 160, 84, 0.25)',
          background: 'linear-gradient(90deg, rgba(232, 160, 84, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%), #12151e',
          padding: '18px 22px',
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: colors.accent, fontFamily: fonts.mono, marginBottom: 10 }}>
          OPERATIONAL RELATIONSHIP LINEAGE
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 12.5 }}>
          {/* Agent */}
          <div style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(167, 139, 250, 0.15)', border: '1px solid rgba(167, 139, 250, 0.3)', color: '#a78bfa', fontWeight: 650 }}>
            {agent.name ?? agent.agentId}
          </div>
          <ChevronRight size={14} style={{ color: colors.muted }} />

          {/* Work Package */}
          <div style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)', color: colors.text, fontFamily: fonts.mono }}>
            {wpId ? `WP: ${wpId}` : 'Standby Package'}
          </div>
          <ChevronRight size={14} style={{ color: colors.muted }} />

          {/* Project */}
          <div style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(93, 206, 160, 0.1)', border: '1px solid rgba(93, 206, 160, 0.25)', color: colors.success, fontWeight: 600 }}>
            {projectName ?? 'Across Portfolio'}
          </div>
          <ChevronRight size={14} style={{ color: colors.muted }} />

          {/* Objective */}
          <div style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)', color: colors.text, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {objective}
          </div>
          <ChevronRight size={14} style={{ color: colors.muted }} />

          {/* Output */}
          <div style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(232, 160, 84, 0.15)', border: '1px solid rgba(232, 160, 84, 0.3)', color: colors.accent, fontWeight: 650 }}>
            {targetOutput}
          </div>
        </div>
      </section>

      {/* Tabs & Content Sections: Overview, Current Work, Runs, Artifacts, Activity, Performance */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
        {/* Overview & Identity */}
        <div
          style={{
            padding: '20px 22px',
            borderRadius: 16,
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            display: 'grid',
            gap: 14,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: colors.text }}>
            Specialist Overview
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <Field label="Specialist Mandate" value={agent.specialistId} mono />
            <Field label="Department" value={agent.department ?? 'Specialist Workforce'} />
            <Field label="Control State" value={agent.controlState.toUpperCase()} />
            <Field label="Assigned Project" value={projectName ?? 'Portfolio wide'} />
            <Field label="Current Work Package" value={wpId ?? 'None'} mono />
            <Field label="Total Runs Recorded" value={String(recentRuns.length)} mono />
          </div>
        </div>

        {/* Current Work */}
        <div
          style={{
            padding: '20px 22px',
            borderRadius: 16,
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            display: 'grid',
            gap: 14,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: colors.text }}>
            Current Assignment
          </div>
          <div>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: colors.muted }}>
              Active Task Title
            </div>
            <div style={{ fontSize: 14, fontWeight: 650, color: colors.text, marginTop: 4 }}>
              {currentTask?.title ?? 'No task assigned currently'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: colors.muted }}>
              Task Acceptance Criteria
            </div>
            {currentTask?.acceptanceCriteria && currentTask.acceptanceCriteria.length > 0 ? (
              <ul style={{ margin: '6px 0 0', paddingLeft: 18, color: colors.muted, fontSize: 12, display: 'grid', gap: 3 }}>
                {currentTask.acceptanceCriteria.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            ) : (
              <div style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>Standard specialist quality gate assertions apply.</div>
            )}
          </div>
        </div>

        {/* Runs History */}
        <div
          style={{
            padding: '20px 22px',
            borderRadius: 16,
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            display: 'grid',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: colors.text }}>
              Execution Runs ({recentRuns.length})
            </span>
            <Link href="/agent-runs" style={{ fontSize: 11.5, color: colors.accent, textDecoration: 'none' }}>
              All Runs →
            </Link>
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            {recentRuns.slice(0, 4).map((r) => (
              <div
                key={r.workPackageId}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 12,
                  padding: '8px 10px',
                  borderRadius: radii.sm,
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                }}
              >
                <div>
                  <div style={{ fontFamily: fonts.mono, color: colors.text, fontWeight: 600 }}>
                    {r.workPackageId}
                  </div>
                  <div style={{ color: colors.muted, fontSize: 10.5 }}>
                    {r.toolCalls.length} tool calls · {r.failures.length} failures
                  </div>
                </div>
                <StatusBadge tone={r.status === 'completed' ? 'completed' : r.status === 'failed' ? 'failed' : 'working'} label={r.status} />
              </div>
            ))}
            {recentRuns.length === 0 && (
              <div style={{ padding: '16px 0', textAlign: 'center', color: colors.muted, fontSize: 12 }}>
                No execution runs recorded yet.
              </div>
            )}
          </div>
        </div>

        {/* Produced Artifacts */}
        <div
          style={{
            padding: '20px 22px',
            borderRadius: 16,
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            display: 'grid',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: colors.text }}>
              Sealed Artifacts ({agentArtifacts.length})
            </span>
            <Link href="/artifacts" style={{ fontSize: 11.5, color: colors.accent, textDecoration: 'none' }}>
              All Artifacts →
            </Link>
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            {agentArtifacts.slice(0, 4).map((a) => (
              <div
                key={a.id || a.artifactId}
                style={{
                  padding: '10px 12px',
                  borderRadius: radii.sm,
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: colors.text }}>{a.artifactId}</div>
                  <div style={{ fontSize: 10.5, color: colors.muted, fontFamily: fonts.mono }}>Type: {a.artifactType}</div>
                </div>
                <span style={{ fontSize: 10, fontFamily: fonts.mono, color: colors.success }}>
                  {a.acceptanceStatus.toUpperCase()}
                </span>
              </div>
            ))}
            {agentArtifacts.length === 0 && (
              <div style={{ padding: '16px 0', textAlign: 'center', color: colors.muted, fontSize: 12 }}>
                No sealed artifacts produced by this specialist yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Activity Timeline & Technical Drawer */}
      {run ? (
        <section
          style={{
            padding: '20px 22px',
            borderRadius: 16,
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            display: 'grid',
            gap: 14,
          }}
        >
          <div style={{ fontSize: 13.5, fontWeight: 700, color: colors.text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Current Run Activity Stream
          </div>
          <RunTimeline run={run} />
        </section>
      ) : null}

      <LocalGraphPanel
        focusLabel={agent.name ?? agent.agentId}
        focusType="Agent"
        scope={{ agentId: agent.agentId }}
      />
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: colors.muted, marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontFamily: mono ? fonts.mono : fonts.sans, fontSize: 13, color: colors.text }}>{value}</div>
    </div>
  );
}

function RunTimeline({ run }: { run: AgentRunRecord }) {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {run.actionLog.map((entry, idx) => (
        <div key={`${entry.at}-${idx}`} style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 12, fontSize: 12, padding: '8px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
          <span style={{ fontFamily: fonts.mono, color: colors.muted }}>{formatRelativeTime(entry.at)}</span>
          <span style={{ color: colors.text }}>{entry.summary}</span>
        </div>
      ))}
      {run.actionLog.length === 0 ? <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>No action events recorded in current run.</p> : null}
      <div style={{ marginTop: 10 }}>
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
