import { Card, colors, fonts, radii } from '@umer/ui';
import { getArtifacts } from '@/lib/control-api';

export const dynamic = 'force-dynamic';

export default async function ArtifactsPage() {
  const artifacts = await getArtifacts();
  const sorted = [...artifacts].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <header>
        <h1 style={{ fontSize: 'clamp(1.5rem, 2.6vw, 2rem)', fontWeight: 650, margin: 0, letterSpacing: '-0.03em' }}>
          Artifacts ({artifacts.length})
        </h1>
        <p style={{ margin: '8px 0 0', color: colors.muted, fontSize: 14, maxWidth: 640, lineHeight: 1.5 }}>
          Read from the real Artifact Runtime (<code style={{ fontFamily: fonts.mono }}>@umer/artifacts</code>) via{' '}
          <code style={{ fontFamily: fonts.mono }}>GET /v1/artifacts</code>. This store is separate from whichever
          engine instance a live agent worker seals artifacts through, so it may be empty even while agents are
          producing artifacts elsewhere — that's an honest gap, not a bug, until both are wired to the same instance.
        </p>
      </header>

      {sorted.length === 0 ? (
        <Card>
          <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>No artifacts sealed in this store yet.</p>
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
