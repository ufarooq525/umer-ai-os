import Link from 'next/link';
import { Card, colors, radii } from '@umer/ui';
import { getTasks, getWorkProjects } from '@/lib/control-api';
import { StatusBadge } from '@/components/os/StatusBadge';
import { projectTone } from '@/components/os/status';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  const [projects, tasks] = await Promise.all([getWorkProjects(), getTasks()]);

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <header>
        <h1 style={{ fontSize: 'clamp(1.5rem, 2.6vw, 2rem)', fontWeight: 650, margin: 0, letterSpacing: '-0.03em' }}>
          Projects ({projects.length})
        </h1>
        <p style={{ margin: '8px 0 0', color: colors.muted, fontSize: 14 }}>
          Work Management projects — distinct from the registry codebases at{' '}
          <Link href="/projects" style={{ color: colors.accent }}>
            Codebases
          </Link>
          .
        </p>
      </header>

      {projects.length === 0 ? (
        <Card>
          <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>No projects yet.</p>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          {projects.map((project) => {
            const projectTasks = tasks.filter((t) => t.projectId === project.projectId);
            const done = projectTasks.filter((t) => t.status === 'Done').length;
            return (
              <Link
                key={project.projectId}
                href={`/company/projects/${project.projectId}`}
                style={{
                  display: 'block',
                  padding: 16,
                  borderRadius: radii.lg,
                  border: `1px solid ${colors.border}`,
                  background: colors.surface,
                  textDecoration: 'none',
                  color: colors.text,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <strong style={{ fontSize: 15 }}>{project.name}</strong>
                  <StatusBadge tone={projectTone(project.status)} label={project.status} />
                </div>
                <div style={{ fontSize: 12, color: colors.muted, marginTop: 6 }}>
                  owner {project.owner ?? '—'}
                  {project.sourceOpportunityId ? ' · from an opportunity' : ''}
                </div>
                {projectTasks.length > 0 ? (
                  <div style={{ marginTop: 10, fontSize: 12, color: colors.muted }}>
                    {done}/{projectTasks.length} tasks done
                  </div>
                ) : null}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
