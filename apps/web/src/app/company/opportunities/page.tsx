import { Suspense } from 'react';
import Link from 'next/link';
import { Card, colors } from '@umer/ui';
import { getOpportunities } from '@/lib/control-api';
import { OpportunityList } from '@/components/os/OpportunityList';

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
          Ranked by score. Click a row to inspect it here — Maps, website check, and a one-page proposal. Decide from{' '}
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
        <Suspense fallback={<p style={{ color: colors.muted }}>Loading list…</p>}>
          <OpportunityList opportunities={sorted} />
        </Suspense>
      )}
    </div>
  );
}
