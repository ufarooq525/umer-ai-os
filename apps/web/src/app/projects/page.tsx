import { Badge, Card, colors } from '@umer/ui';
import { getProjects } from '@/lib/control-api';
import { IntakeForm } from '@/components/IntakeForm';
import { StatusBadge } from '@/components/os/StatusBadge';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  const { projects, projectsRoot } = await getProjects();
  const missing = projects.filter((p) => p.onDisk === false);

  return (
    <>
      <header style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 500, margin: 0 }}>Codebases</h1>
        <p style={{ marginTop: 8, color: colors.muted, fontSize: 14, maxWidth: 720, lineHeight: 1.5 }}>
          Catalog paths under <code>{projectsRoot}</code>. A project can be a live website with no local folder —
          that is shown as missing on disk, not as a fake repo.
        </p>
      </header>

      {missing.length > 0 ? (
        <Card title="Not on this machine" style={{ marginBottom: 20 }}>
          <p style={{ margin: 0, fontSize: 13, color: colors.muted, lineHeight: 1.5 }}>
            {missing.map((p) => p.name).join(', ')} {missing.length === 1 ? 'is' : 'are'} in the catalog but the folder
            is not under Laragon www. Do not run apply/intake that writes files until the repo exists. Live SEO can
            still check a public URL.
          </p>
        </Card>
      ) : null}

      <div style={{ marginBottom: 24 }}>
        <IntakeForm projects={projects} />
      </div>

      <Card title={`${projects.length} catalog entries`}>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 16 }}>
          {projects.map((project) => {
            const onDisk = project.onDisk === true;
          const diskUnknown = project.onDisk == null;
            return (
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
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: colors.muted }}>
                      {project.projectId} · {project.absolutePath}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <StatusBadge
                      tone={onDisk ? 'working' : diskUnknown ? 'idle' : 'blocked'}
                      label={onDisk ? 'ON DISK' : diskUnknown ? 'DISK UNKNOWN' : 'NOT ON DISK'}
                    />
                    <Badge tone={project.status === 'active' ? 'success' : 'default'}>{project.status}</Badge>
                  </div>
                </div>
                <p style={{ margin: '8px 0 0', fontSize: 13, color: colors.muted }}>
                  Stack: {project.stack.join(', ') || '—'}
                  {project.seoBaseUrl ? (
                    <>
                      {' · '}
                      <a href={project.seoBaseUrl} target="_blank" rel="noreferrer" style={{ color: colors.accent }}>
                        {project.seoBaseUrl}
                      </a>
                    </>
                  ) : null}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: colors.muted }}>
                  Specialists: {project.defaultSpecialists.join(', ')}
                </p>
                {project.constraints.length > 0 ? (
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: colors.muted }}>
                    Constraints: {project.constraints.join(' · ')}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}
