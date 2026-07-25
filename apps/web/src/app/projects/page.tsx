import { Badge, Card, colors } from '@umer/ui';
import { getProjects } from '@/lib/control-api';
import { IntakeForm } from '@/components/IntakeForm';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  const { projects, projectsRoot } = await getProjects();

  return (
    <>
      <header style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 500, margin: 0 }}>Projects</h1>
        <p style={{ marginTop: 8, opacity: 0.8 }}>
          Registered Laragon apps under <code>{projectsRoot}</code>. Add more in{' '}
          <code>projects/catalog.json</code>.
        </p>
      </header>

      <div style={{ marginBottom: 24 }}>
        <IntakeForm projects={projects} />
      </div>

      <Card title={`${projects.length} projects`}>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 16 }}>
          {projects.map((project) => (
            <li
              key={project.projectId}
              style={{
                paddingBottom: 16,
                borderBottom: `1px solid ${colors.border}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <strong>{project.name}</strong>
                  <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.75 }}>
                    {project.projectId} · {project.absolutePath}
                  </p>
                </div>
                <Badge tone={project.status === 'active' ? 'success' : 'default'}>{project.status}</Badge>
              </div>
              <p style={{ margin: '8px 0 0', fontSize: 13, opacity: 0.85 }}>
                Stack: {project.stack.join(', ') || '—'}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.85 }}>
                Specialists: {project.defaultSpecialists.join(', ')}
              </p>
              {project.constraints.length > 0 ? (
                <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.7 }}>
                  Constraints: {project.constraints.join(' · ')}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
