import Link from 'next/link';
import { Card, colors, fonts, radii } from '@umer/ui';
import { getOpportunities } from '@/lib/control-api';
import { OpportunityJourney } from '@/components/os/OpportunityJourney';

export const dynamic = 'force-dynamic';

export default async function OpportunitiesPage() {
  const opportunities = await getOpportunities();
  const sorted = [...opportunities].sort((a, b) => (b.score?.overall ?? 0) - (a.score?.overall ?? 0));

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <header>
        <h1 style={{ fontSize: 'clamp(1.5rem, 2.6vw, 2rem)', fontWeight: 650, margin: 0, letterSpacing: '-0.03em' }}>
          Opportunities ({opportunities.length})
        </h1>
        <p style={{ margin: '8px 0 0', color: colors.muted, fontSize: 14 }}>
          Every opportunity discovered so far, ranked by score. Decide on one from{' '}
          <Link href="/decisions" style={{ color: colors.accent }}>
            Decisions
          </Link>
          .
        </p>
      </header>

      {sorted.length === 0 ? (
        <Card>
          <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>No opportunities discovered yet.</p>
        </Card>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {sorted.map((opp) => (
            <Link
              key={opp.id}
              href={`/company/opportunities/${opp.id}`}
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
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <strong style={{ fontSize: 15 }}>{opp.title}</strong>
                  <div style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                    {opp.geography} · {opp.market}
                    {opp.estimatedValueMin != null ? ` · ${opp.currency ?? 'USD'} ${opp.estimatedValueMin}-${opp.estimatedValueMax}` : ''}
                  </div>
                </div>
                {opp.score ? (
                  <div style={{ fontFamily: fonts.mono, fontSize: 20, fontWeight: 700, color: colors.accent }}>
                    {opp.score.overall}
                    <span style={{ fontSize: 11, color: colors.muted }}>/100</span>
                  </div>
                ) : null}
              </div>
              <div style={{ marginTop: 10 }}>
                <OpportunityJourney status={opp.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
