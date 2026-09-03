import Link from 'next/link';
import { Card, colors, fonts } from '@umer/ui';
import { getAgents, getTasks, getWorkProjects } from '@/lib/control-api';
import { StatusBadge } from '@/components/os/StatusBadge';
import { taskTone } from '@/components/os/status';

export const dynamic = 'force-dynamic';

const COLUMNS = ['Backlog', 'Ready', 'Assigned', 'InProgress', 'InReview', 'Blocked', 'Done', 'Cancelled'] as const;

export default async function TasksPage() {
  const [tasks, projects, agents] = await Promise.all([getTasks(), getWorkProjects(), getAgents()]);
  const projectById = new Map(projects.map((p) => [p.projectId, p]));
  const agentById = new Map(agents.map((a) => [a.agentId, a]));

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <header>
        <h1 style={{ fontSize: 'clamp(1.5rem, 2.6vw, 2rem)', fontWeight: 650, margin: 0, letterSpacing: '-0.03em' }}>
          Tasks ({tasks.length})
        </h1>
        <p style={{ margin: '8px 0 0', color: colors.muted, fontSize: 14 }}>Every task, grouped by status.</p>
      </header>

      {tasks.length === 0 ? (
        <Card>
          <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>No tasks yet.</p>
        </Card>
      ) : (
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
          {COLUMNS.map((status) => {
            const columnTasks = tasks.filter((t) => t.status === status);
            if (columnTasks.length === 0) return null;
            return (
              <div key={status} style={{ minWidth: 240, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <StatusBadge tone={taskTone(status)} label={status} />
                  <span style={{ fontSize: 11, color: colors.muted, fontFamily: fonts.mono }}>{columnTasks.length}</span>
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {columnTasks.map((task) => {
                    const project = projectById.get(task.projectId);
                    const agent = task.assignedAgentId ? agentById.get(task.assignedAgentId) : undefined;
                    return (
                      <Link
                        key={task.taskId}
                        href={project ? `/company/projects/${project.projectId}` : '/company/tasks'}
                        style={{
                          display: 'block',
                          padding: 10,
                          borderRadius: 10,
                          border: `1px solid ${colors.border}`,
                          background: colors.surface,
                          textDecoration: 'none',
                          color: colors.text,
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{task.title}</div>
                        <div style={{ fontSize: 11, color: colors.muted, marginTop: 4 }}>
                          {project?.name ?? task.projectId} · {agent ? agent.name ?? agent.agentId : 'unassigned'}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
