import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Bot, ChevronRight } from 'lucide-react';
import { colors, fonts, radii } from '@umer/ui';
import { getAgents, getOpportunity, getTasks, getWorkGraph, getWorkProject, getWorkPackages, getArtifacts } from '@/lib/control-api';
import { StatusBadge } from '@/components/os/StatusBadge';
import { WorkGraphBoard } from '@/components/os/WorkGraphBoard';
import { RunAuditPanel } from '@/components/os/RunAuditPanel';
import { projectTone, taskTone } from '@/components/os/status';
import { CompanySubNav } from '@/components/os/CompanySubNav';
import { LocalGraphPanel } from '@/components/os/LocalGraphPanel';

export const dynamic = 'force-dynamic';

async function settled<T>(task: Promise<T>, fallback: T): Promise<T> {
  try {
    return await task;
  } catch {
    return fallback;
  }
}

const LIFECYCLE_STAGES = [
  { id: 'requirements', label: 'Requirements' },
  { id: 'product', label: 'Product' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'ux', label: 'UX' },
  { id: 'implementation', label: 'Engineering' },
  { id: 'qa', label: 'QA' },
  { id: 'security', label: 'Security' },
  { id: 'release', label: 'Release' },
  { id: 'operations', label: 'Operations' },
];

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getWorkProject(id);
  if (!project) notFound();

  const [tasks, agents, opportunity, workGraph, workPackages, artifacts] = await Promise.all([
    getTasks(),
    getAgents(),
    project.sourceOpportunityId ? getOpportunity(project.sourceOpportunityId) : Promise.resolve(null),
    settled(getWorkGraph(project.projectId), { projectId: project.projectId, nodes: [], edges: [] }),
    settled(getWorkPackages(), []),
    settled(getArtifacts(), []),
  ]);

  const projectTasks = tasks.filter((t) => t.projectId === project.projectId);
  const blockedTasks = projectTasks.filter((t) => t.status === 'Blocked');
  const doneTasks = projectTasks.filter((t) => t.status === 'Done');
  const progressPercent = projectTasks.length > 0 ? Math.round((doneTasks.length / projectTasks.length) * 100) : 0;

  const agentIds = new Set(projectTasks.map((t) => t.assignedAgentId).filter(Boolean) as string[]);
  const projectAgents = agents.filter((a) => agentIds.has(a.agentId) || a.currentProjectId === project.projectId);
  const projectWps = workPackages.filter((w) => w.projectId === project.projectId);
  const projectArtifacts = artifacts.filter((a) => a.producedFor === project.projectId || a.sourceTaskId && projectTasks.some((t) => t.taskId === a.sourceTaskId));

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 12 }}>
          <Link href="/company/projects" style={{ fontSize: 12.5, color: colors.muted, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
            ← All Projects
          </Link>
          <span style={{ color: 'rgba(255, 255, 255, 0.2)' }}>/</span>
          <Link
            href={`/company/graph?projectId=${encodeURIComponent(project.projectId)}`}
            style={{ fontSize: 12.5, color: colors.accent, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <span>⬡</span> View Project Delivery Graph
          </Link>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h1 style={{ fontSize: 'clamp(1.5rem, 2.6vw, 2.2rem)', fontWeight: 650, margin: 0, letterSpacing: '-0.03em', color: '#ffffff' }}>
                {project.name}
              </h1>
              <StatusBadge tone={projectTone(project.status)} label={project.status} />
            </div>
            <p style={{ margin: '4px 0 0', color: colors.muted, fontSize: 13, fontFamily: fonts.mono }}>
              ID: {project.projectId} · Owner: {project.owner ?? 'Engineering Specialist'} · {projectWps.length} Work Package{projectWps.length === 1 ? '' : 's'}
            </p>

          </div>

          {opportunity && (
            <Link
              href={`/company/opportunities/${opportunity.id}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 8,
                border: '1px solid rgba(232, 160, 84, 0.35)',
                background: 'rgba(232, 160, 84, 0.1)',
                color: colors.accent,
                fontSize: 12.5,
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              Source Opportunity: {opportunity.title.slice(0, 24)}... →
            </Link>
          )}
        </div>
      </div>

      <CompanySubNav />

      {/* HORIZONTAL COMPANY DELIVERY FLOW FOR THIS PROJECT */}
      <section
        style={{
          borderRadius: 16,
          border: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%), #11141c',
          padding: '16px 20px',
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: colors.accent, fontFamily: fonts.mono, marginBottom: 12 }}>
          PROJECT DELIVERY STAGE STATUS
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {LIFECYCLE_STAGES.map((stage, idx) => {
            const hasNode = workGraph.nodes.some((n) => n.type.toLowerCase().includes(stage.id));
            const node = workGraph.nodes.find((n) => n.type.toLowerCase().includes(stage.id));
            const isDone = node?.status === 'Accepted' || progressPercent === 100;
            const isInProg = node?.status === 'InProgress' || node?.status === 'Ready';

            return (
              <div key={stage.id} style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: radii.sm,
                    background: isDone
                      ? 'rgba(93, 206, 160, 0.1)'
                      : isInProg
                        ? 'rgba(232, 160, 84, 0.12)'
                        : 'rgba(255, 255, 255, 0.02)',
                    border: `1px solid ${isDone ? 'rgba(93, 206, 160, 0.25)' : isInProg ? 'rgba(232, 160, 84, 0.3)' : 'rgba(255, 255, 255, 0.06)'}`,
                    fontSize: 11,
                    fontWeight: 650,
                    color: isDone ? colors.success : isInProg ? colors.accent : colors.muted,
                  }}
                >
                  {stage.label}
                  <div style={{ fontSize: 9, fontFamily: fonts.mono, fontWeight: 700, textTransform: 'uppercase', marginTop: 2 }}>
                    {node ? node.status : hasNode ? 'Planned' : 'Standard'}
                  </div>
                </div>
                {idx < LIFECYCLE_STAGES.length - 1 && (
                  <ChevronRight size={12} style={{ color: 'rgba(255, 255, 255, 0.2)', flexShrink: 0 }} />
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* TWO-COLUMN EXECUTIVE LAYOUT */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20, alignItems: 'flex-start' }}>
        {/* LEFT COLUMN: Project Overview, Progress, Work Graph */}
        <div style={{ display: 'grid', gap: 20 }}>
          {/* Progress & Overview Panel */}
          <div
            style={{
              padding: '20px 22px',
              borderRadius: 16,
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              display: 'grid',
              gap: 16,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: colors.text }}>
              Project Posture
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: colors.muted, marginBottom: 6 }}>
                <span>Delivery Completion</span>
                <span style={{ fontFamily: fonts.mono, fontWeight: 700, color: colors.text }}>{progressPercent}%</span>
              </div>
              <div style={{ width: '100%', height: 6, borderRadius: 999, background: 'rgba(255, 255, 255, 0.08)', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${progressPercent}%`,
                    height: '100%',
                    borderRadius: 999,
                    background: progressPercent === 100 ? colors.success : colors.accent,
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              <div>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: colors.muted }}>Tasks Done</div>
                <div style={{ fontFamily: fonts.mono, fontSize: 16, fontWeight: 700, color: colors.text, marginTop: 2 }}>
                  {doneTasks.length} / {projectTasks.length}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: colors.muted }}>Active Blockers</div>
                <div style={{ fontFamily: fonts.mono, fontSize: 16, fontWeight: 700, color: blockedTasks.length > 0 ? colors.danger : colors.success, marginTop: 2 }}>
                  {blockedTasks.length} Blocked
                </div>
              </div>
            </div>
          </div>

          {/* Work Graph Board */}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: colors.text }}>
                Project Work Graph ({workGraph.nodes.length} nodes)
              </span>
              <RunAuditPanel projectId={project.projectId} />
            </div>
            <WorkGraphBoard nodes={workGraph.nodes} edges={workGraph.edges} />
          </div>

          {/* Tasks List */}
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
            <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: colors.text }}>
              Tasks ({projectTasks.length})
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {projectTasks.map((task) => (
                <div
                  key={task.taskId}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 10px',
                    borderRadius: radii.sm,
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    fontSize: 12.5,
                  }}
                >
                  <span style={{ color: colors.text }}>{task.title}</span>
                  <StatusBadge tone={taskTone(task.status)} label={task.status} />
                </div>
              ))}
              {projectTasks.length === 0 && (
                <div style={{ padding: '16px 0', textAlign: 'center', color: colors.muted, fontSize: 12.5 }}>
                  No tasks defined for this project yet.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Active Agents, Artifacts, Attention */}
        <div style={{ display: 'grid', gap: 20 }}>
          {/* Active Agents on Project */}
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
            <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: colors.text }}>
              Assigned Specialist Agents ({projectAgents.length})
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {projectAgents.map((agent) => (
                <Link
                  key={agent.agentId}
                  href={`/company/agents/${agent.agentId}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 12px',
                    borderRadius: radii.sm,
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    textDecoration: 'none',
                    color: colors.text,
                    fontSize: 13,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Bot size={14} style={{ color: '#a78bfa' }} />
                    <span style={{ fontWeight: 600 }}>{agent.name ?? agent.agentId}</span>
                  </div>
                  <span style={{ fontSize: 11, fontFamily: fonts.mono, color: colors.muted }}>
                    {agent.specialistId}
                  </span>
                </Link>
              ))}
              {projectAgents.length === 0 && (
                <div style={{ padding: '16px 0', textAlign: 'center', color: colors.muted, fontSize: 12.5 }}>
                  No agents currently executing work on this project.
                </div>
              )}
            </div>
          </div>

          {/* Sealed Artifacts */}
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
            <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: colors.text }}>
              Project Artifacts ({projectArtifacts.length})
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {projectArtifacts.map((art) => (
                <div
                  key={art.id || art.artifactId}
                  style={{
                    padding: '10px 12px',
                    borderRadius: radii.sm,
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: 12.5,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: colors.text }}>{art.artifactId}</div>
                    <div style={{ fontSize: 10.5, color: colors.muted, fontFamily: fonts.mono }}>Type: {art.artifactType}</div>
                  </div>
                  <span style={{ fontSize: 10, fontFamily: fonts.mono, color: colors.success }}>
                    {art.acceptanceStatus.toUpperCase()}
                  </span>
                </div>
              ))}
              {projectArtifacts.length === 0 && (
                <div style={{ padding: '16px 0', textAlign: 'center', color: colors.muted, fontSize: 12.5 }}>
                  No sealed artifacts registered for this project yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <LocalGraphPanel
        focusLabel={project.name}
        focusType="Project"
        scope={{ projectId: project.projectId }}
      />
    </div>
  );
}
