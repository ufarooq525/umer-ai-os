import Link from 'next/link';
import { colors, fonts } from '@umer/ui';
import { getTasks, getWorkProjects, getArtifacts } from '@/lib/control-api';
import { DeliverySubNav } from '@/components/os/DeliverySubNav';
import { FileCode, CheckSquare } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function DeliveryRequirementsPage() {
  const [tasks, projects, artifacts] = await Promise.all([
    getTasks().catch(() => []),
    getWorkProjects().catch(() => []),
    getArtifacts().catch(() => []),
  ]);

  const reqArtifacts = artifacts.filter(
    (a) =>
      a.artifactType.toLowerCase().includes('requirement') ||
      a.artifactType.toLowerCase().includes('product') ||
      a.artifactType.toLowerCase().includes('spec'),
  );

  const projectsMap = new Map(projects.map((p) => [p.projectId, p]));

  return (
    <div style={{ display: 'grid', gap: 24, maxWidth: 1400, margin: '0 auto' }}>
      <DeliverySubNav />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.02em', color: colors.text }}>
            Requirements & Scope Decomposition
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: colors.muted }}>
            Formal problem framing, acceptance criteria, constraints, and scope contracts across all projects.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              fontSize: 12,
              fontFamily: fonts.mono,
              color: colors.muted,
            }}
          >
            Tasks with Acceptance Criteria:{' '}
            <span style={{ color: colors.accent, fontWeight: 700 }}>
              {tasks.filter((t) => t.acceptanceCriteria && t.acceptanceCriteria.length > 0).length}
            </span>
          </div>
        </div>
      </div>

      {/* Formal Requirements Artifacts Section */}
      <section>
        <h3 style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: colors.muted, margin: '0 0 14px' }}>
          Sealed Specifications & Briefs ({reqArtifacts.length})
        </h3>
        {reqArtifacts.length === 0 ? (
          <div
            style={{
              background: colors.surface,
              border: `1px dashed ${colors.border}`,
              borderRadius: 10,
              padding: '24px 20px',
              color: colors.muted,
              fontSize: 13,
            }}
          >
            No formal requirement briefs generated yet. As `req.formalize` runs, specs will be archived here.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
            {reqArtifacts.map((art) => (
              <div
                key={art.id}
                style={{
                  background: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 10,
                  padding: 16,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 650, color: colors.text }}>{art.artifactId}</div>
                  <div style={{ fontSize: 11, color: colors.muted, marginTop: 3 }}>
                    By: {art.producedBy} · Type: {art.artifactType}
                  </div>
                </div>
                <Link
                  href={`/artifacts?id=${art.id}`}
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: colors.accent,
                    textDecoration: 'none',
                    padding: '4px 10px',
                    borderRadius: 6,
                    background: colors.accentSoft,
                  }}
                >
                  Inspect →
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Structured Scope Breakdown from Tasks */}
      <section>
        <h3 style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: colors.muted, margin: '0 0 14px' }}>
          Decomposed Work Packages & Criteria ({tasks.length})
        </h3>

        {tasks.length === 0 ? (
          <div
            style={{
              background: colors.surface,
              border: `1px dashed ${colors.border}`,
              borderRadius: 12,
              padding: '48px 24px',
              textAlign: 'center',
            }}
          >
            <FileCode size={36} style={{ color: colors.muted, margin: '0 auto 12px', opacity: 0.6 }} />
            <h4 style={{ fontSize: 15, fontWeight: 650, color: colors.text, margin: 0 }}>No Work Tasks In System</h4>
            <p style={{ fontSize: 13, color: colors.muted, maxWidth: 420, margin: '6px auto 16px' }}>
              Tasks are decomposed when projects are initiated from validated opportunities.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            {tasks.map((task) => {
              const project = projectsMap.get(task.projectId);
              const criteria = task.acceptanceCriteria ?? [];

              return (
                <div
                  key={task.taskId}
                  style={{
                    background: colors.surface,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 12,
                    padding: 20,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            fontFamily: fonts.mono,
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 4,
                            background: task.status === 'done' || task.status === 'completed'
                              ? 'rgba(34, 197, 94, 0.15)'
                              : 'rgba(96, 165, 250, 0.15)',
                            color: task.status === 'done' || task.status === 'completed' ? colors.success : '#60a5fa',
                            textTransform: 'uppercase',
                          }}
                        >
                          {task.status}
                        </span>
                        {project && (
                          <Link
                            href={`/company/projects/${project.projectId}`}
                            style={{ fontSize: 12, color: colors.accent, textDecoration: 'none' }}
                          >
                            {project.name}
                          </Link>
                        )}
                      </div>
                      <h4 style={{ fontSize: 16, fontWeight: 650, color: colors.text, margin: '8px 0 4px' }}>
                        {task.title}
                      </h4>
                      {task.description && (
                        <p style={{ fontSize: 13, color: colors.muted, margin: '4px 0 0', lineHeight: 1.5 }}>
                          {task.description}
                        </p>
                      )}
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      {task.assignedAgentId && (
                        <div style={{ fontSize: 12, color: colors.muted }}>
                          Assigned: <span style={{ color: colors.text, fontWeight: 600 }}>{task.assignedAgentId}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Acceptance Criteria Box */}
                  {criteria.length > 0 && (
                    <div
                      style={{
                        marginTop: 16,
                        padding: '12px 16px',
                        borderRadius: 8,
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: colors.muted, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <CheckSquare size={13} style={{ color: colors.accent }} />
                        <span>Acceptance Criteria ({criteria.length})</span>
                      </div>
                      <div style={{ display: 'grid', gap: 6 }}>
                        {criteria.map((c, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: colors.text }}>
                            <span style={{ color: colors.accent, fontFamily: fonts.mono, fontSize: 11 }}>[{i + 1}]</span>
                            <span>{c}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
