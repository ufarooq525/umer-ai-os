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
        <div style={{ display: 'grid', gap: 8 }}>
          {sorted.map((artifact) => (
            <div
              key={artifact.artifactId}
              style={{
                padding: 14,
                borderRadius: radii.lg,
                border: `1px solid ${colors.border}`,
                background: colors.surface,
                color: colors.text,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <strong style={{ fontSize: 13, fontFamily: fonts.mono }}>{artifact.artifactId}</strong>
                <span style={{ fontSize: 11, color: colors.muted, fontFamily: fonts.mono }}>{artifact.acceptanceStatus}</span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: colors.muted }}>
                {artifact.artifactType} · v{artifact.version} · produced by {artifact.producedBy}
                {artifact.sourceTaskId ? ` · task ${artifact.sourceTaskId}` : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
