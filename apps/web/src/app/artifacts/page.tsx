import { Card, colors, fonts, radii } from '@umer/ui';
import { getArtifacts } from '@/lib/control-api';
import { TechnicalDetailsDrawer } from '@/components/os/TechnicalDetailsDrawer';

export const dynamic = 'force-dynamic';

const EXAMPLE_OUTPUTS = ['Research reports', 'Market analysis', 'Prospect lists', 'Evidence', 'Product specifications', 'Validation reports'];

export default async function ArtifactsPage() {
  const artifacts = await getArtifacts();
  const sorted = [...artifacts].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <header>
        <h1 style={{ fontSize: 'clamp(1.5rem, 2.6vw, 2rem)', fontWeight: 650, margin: 0, letterSpacing: '-0.03em' }}>
          Company Knowledge &amp; Outputs {artifacts.length > 0 ? `(${artifacts.length})` : ''}
        </h1>
        <p style={{ margin: '8px 0 0', color: colors.muted, fontSize: 14, maxWidth: 640, lineHeight: 1.5 }}>
          Everything the company's agents have produced and sealed as a finished output.
        </p>
      </header>

      {sorted.length === 0 ? (
        <Card>
          <p style={{ margin: '0 0 12px', color: colors.text, fontSize: 14, lineHeight: 1.6 }}>
            No company outputs are currently available in this workspace.
          </p>
          <p
            style={{
              margin: '0 0 8px',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: colors.muted,
            }}
          >
            Artifacts will appear here as agents produce
          </p>
          <div style={{ display: 'grid', gap: 4, opacity: 0.6, marginBottom: 14 }}>
            {EXAMPLE_OUTPUTS.map((item) => (
              <div key={item} style={{ fontSize: 13, color: colors.muted }}>
                • {item}
              </div>
            ))}
          </div>
          <TechnicalDetailsDrawer
            label="Technical details"
            data={{
              note: 'Control API reads from the Artifact Runtime instance it owns; a live agent worker may seal artifacts through a separate engine instance until both are wired to the same store.',
              endpoint: 'GET /v1/artifacts',
              package: '@umer/artifacts',
            }}
          />
        </Card>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {sorted.map((artifact) => {
            const isAccepted = artifact.acceptanceStatus === 'accepted';
            const statusColor = isAccepted ? '#10b981' : '#f59e0b';

            return (
              <div
                key={artifact.artifactId}
                id={artifact.artifactId}
                style={{
                  padding: 16,
                  borderRadius: radii.lg,
                  border: `1px solid ${colors.border}`,
                  background: colors.surface,
                  color: colors.text,
                  display: 'grid',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                      style={{
                        display: 'inline-block',
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: '#06b6d4',
                      }}
                    />
                    <strong style={{ fontSize: 14, fontFamily: fonts.mono }}>{artifact.artifactId}</strong>
                    <span style={{ fontSize: 12, fontWeight: 600, color: colors.muted }}>
                      ({artifact.artifactType} v{artifact.version})
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontFamily: fonts.mono,
                      padding: '2px 8px',
                      borderRadius: 999,
                      border: `1px solid ${statusColor}44`,
                      background: `${statusColor}18`,
                      color: statusColor,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {artifact.acceptanceStatus}
                  </span>
                </div>

                <p style={{ margin: 0, fontSize: 13, color: colors.muted, lineHeight: 1.4 }}>
                  Produced by <strong style={{ color: colors.text, fontFamily: fonts.mono }}>{artifact.producedBy}</strong>
                  {artifact.sourceTaskId ? ` · Task: ${artifact.sourceTaskId}` : ''}
                  {artifact.producedFor ? ` · For: ${artifact.producedFor}` : ''}
                </p>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
                  <a
                    href={`/company/graph?search=${encodeURIComponent(artifact.artifactId)}`}
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: colors.accent,
                      textDecoration: 'none',
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: `1px solid rgba(255,255,255,.08)`,
                      background: 'rgba(255,255,255,.03)',
                    }}
                  >
                    Explore in Company Graph →
                  </a>
                  {artifact.producedBy && (
                    <a
                      href={`/agent-runs/${encodeURIComponent(artifact.producedBy)}`}
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: colors.muted,
                        textDecoration: 'none',
                        padding: '4px 10px',
                        borderRadius: 6,
                        border: `1px solid rgba(255,255,255,.08)`,
                        background: 'rgba(255,255,255,.03)',
                      }}
                    >
                      View Originating Agent Run →
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
