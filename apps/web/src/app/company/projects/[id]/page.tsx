import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Card, colors } from '@umer/ui';
import { getAgents, getOpportunity, getTasks, getWorkGraph, getWorkProject } from '@/lib/control-api';
import { EntityNarrative, type NarrativeField } from '@/components/os/EntityNarrative';
import { StatusBadge } from '@/components/os/StatusBadge';
import { WorkGraphBoard } from '@/components/os/WorkGraphBoard';
import { RunAuditPanel } from '@/components/os/RunAuditPanel';
import { projectTone, taskTone } from '@/components/os/status';

export const dynamic = 'force-dynamic';

const PAUSABLE = new Set(['Forming', 'Active', 'Stabilizing']);

async function settled<T>(task: Promise<T>, fallback: T): Promise<T> {
  try {
    return await task;
  } catch {
    return fallback;
  }
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getWorkProject(id);
  if (!project) notFound();

  const [tasks, agents, opportunity, workGraph] = await Promise.all([
    getTasks(),
    getAgents(),
    project.sourceOpportunityId ? getOpportunity(project.sourceOpportunityId) : Promise.resolve(null),
    settled(getWorkGraph(project.projectId), { projectId: project.projectId, nodes: [], edges: [] }),
  ]);

  const projectTasks = tasks.filter((t) => t.projectId === project.projectId);
  const blocked = projectTasks.filter((t) => t.status === 'Blocked');
  const done = projectTasks.filter((t) => t.status === 'Done').length;
  const agentIds = new Set(projectTasks.map((t) => t.assignedAgentId).filter(Boolean) as string[]);
  const projectAgents = agents.filter((a) => agentIds.has(a.agentId));

  const fields: NarrativeField[] = [
    {
      key: 'WHY',
      value: opportunity ? (
        <>
          Opportunity{' '}
          <Link href={`/company/opportunities/${opportunity.id}`} style={{ color: colors.accent }}>
            "{opportunity.title}"
          </Link>{' '}
          selected by the CEO.
        </>
      ) : (
        'Created directly, not sourced from an opportunity.'
      ),
    },
    { key: 'NOW', value: `${project.status}${projectTasks.length > 0 ? ` — ${done}/${projectTasks.length} tasks done` : ''}` },
    {
      key: 'NEXT',
      value:
        blocked.length > 0
          ? `Unblock ${blocked.length} blocked task${blocked.length === 1 ? '' : 's'}.`
          : projectTasks.length === 0
            ? 'Create the first task in Decisions.'
            : done === projectTasks.length
              ? 'All known tasks complete — decide the next phase.'
              : 'Continue in-progress work.',
    },
    { key: 'PROBLEM', value: blocked.length > 0 ? `${blocked.length} task(s) blocked.` : 'None' },
  ];

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <header>
        <Link href="/company/projects" style={{ fontSize: 12, color: colors.muted, textDecoration: 'none' }}>
          ← Projects
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 'clamp(1.4rem, 2.4vw, 1.9rem)', fontWeight: 650, margin: 0, letterSpacing: '-0.03em' }}>
            {project.name}
          </h1>
          <StatusBadge tone={projectTone(project.status)} label={project.status} />
        </div>
        <p style={{ margin: '8px 0 0', color: colors.muted, fontSize: 13 }}>
          {project.projectId} · owner {project.owner ?? '—'}
          {!PAUSABLE.has(project.status) ? ' · terminal or paused' : ''}
        </p>
      </header>

      <EntityNarrative fields={fields} />

      <RunAuditPanel projectId={project.projectId} />

      <Card title="Work Graph">
        <WorkGraphBoard nodes={workGraph.nodes} edges={workGraph.edges} />
      </Card>

      <Card title={`Agents (${projectAgents.length})`}>
        {projectAgents.length === 0 ? (
          <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>No agent has picked up work on this project yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {projectAgents.map((agent) => (
              <Link
                key={agent.agentId}
                href={`/company/agents/${agent.agentId}`}
                style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: colors.text, textDecoration: 'none', padding: '6px 0', borderBottom: `1px solid ${colors.border}` }}
              >
                {agent.name ?? agent.agentId}
                <StatusBadge tone={agent.controlState === 'paused' ? 'paused' : agent.status === 'active' ? 'working' : 'idle'} />
              </Link>
            ))}
          </div>
        )}
      </Card>

      <Card title={`Tasks (${projectTasks.length})`}>
        {projectTasks.length === 0 ? (
          <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>No tasks yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {projectTasks.map((task) => (
              <div key={task.taskId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '6px 0', borderBottom: `1px solid ${colors.border}` }}>
                <span>{task.title}</span>
                <StatusBadge tone={taskTone(task.status)} label={task.status} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
