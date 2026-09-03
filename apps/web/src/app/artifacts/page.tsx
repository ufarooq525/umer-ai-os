import Link from 'next/link';
import { Card, colors, fonts, radii } from '@umer/ui';
import { getAgentRuns, getAgents } from '@/lib/control-api';

export const dynamic = 'force-dynamic';

export default async function ArtifactsPage() {
  const [agentRuns, agents] = await Promise.all([getAgentRuns(), getAgents()]);
  const agentById = new Map(agents.map((a) => [a.agentId, a]));
  const withArtifacts = agentRuns.filter((r) => r.artifactId);

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <header>
        <h1 style={{ fontSize: 'clamp(1.5rem, 2.6vw, 2rem)', fontWeight: 650, margin: 0, letterSpacing: '-0.03em' }}>
          Artifacts ({withArtifacts.length})
        </h1>
        <p style={{ margin: '8px 0 0', color: colors.muted, fontSize: 14, maxWidth: 640, lineHeight: 1.5 }}>
          There is no dedicated Artifacts read endpoint yet — this list is derived from the artifact reference each
          completed Agent Run records. A future <code style={{ fontFamily: fonts.mono }}>/v1/artifacts</code> endpoint
          would let this page show full artifact content and history.
        </p>
      </header>

      {withArtifacts.length === 0 ? (
        <Card>
          <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>No artifacts recorded by any run yet.</p>
        </Card>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {withArtifacts.map((run) => {
            const agent = run.agentId ? agentById.get(run.agentId) : undefined;
            return (
              <Link
                key={run.artifactId}
                href={run.agentId ? `/company/agents/${run.agentId}` : '/artifacts'}
                style={{
                  display: 'block',
                  padding: 14,
                  borderRadius: radii.lg,
                  border: `1px solid ${colors.border}`,
                  background: colors.surface,
                  textDecoration: 'none',
                  color: colors.text,
                }}
              >
                <strong style={{ fontSize: 13, fontFamily: fonts.mono }}>{run.artifactId}</strong>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: colors.muted }}>
                  {run.summary ?? 'No summary recorded.'} — {agent?.name ?? run.agentId ?? 'unknown agent'}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
