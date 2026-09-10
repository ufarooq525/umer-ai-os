import Link from 'next/link';
import { Sparkles, ArrowRight } from 'lucide-react';
import { colors, fonts } from '@umer/ui';
import { getOpportunities } from '@/lib/control-api';
import { OpportunityIntelligenceBoard } from '@/components/os/OpportunityIntelligenceBoard';
import { CompanySubNav } from '@/components/os/CompanySubNav';

export const dynamic = 'force-dynamic';

export default async function OpportunitiesPage() {
  const opportunities = await getOpportunities().catch(() => []);
  const sorted = [...opportunities].sort((a, b) => (b.score?.overall ?? 0) - (a.score?.overall ?? 0));
  const highValueCount = sorted.filter((o) => (o.estimatedValueMax ?? 0) >= 15000 || (o.score?.overall ?? 0) >= 75).length;

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <header>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 'clamp(1.5rem, 2.6vw, 2.1rem)', fontWeight: 650, margin: 0, letterSpacing: '-0.035em', color: '#ffffff' }}>
              Opportunity Intelligence ({opportunities.length})
            </h1>
            <p style={{ margin: '8px 0 0', color: colors.muted, fontSize: 14 }}>
              Ranked commercial &amp; product opportunities evaluated against live evidence and conviction scores.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span
              style={{
                fontFamily: fonts.mono,
                fontSize: 12,
                fontWeight: 650,
                padding: '4px 10px',
                borderRadius: 8,
                background: highValueCount > 0 ? 'rgba(232, 160, 84, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                color: highValueCount > 0 ? colors.accent : colors.muted,
                border: `1px solid ${highValueCount > 0 ? 'rgba(232, 160, 84, 0.35)' : 'rgba(255, 255, 255, 0.08)'}`,
              }}
            >
              {highValueCount} HIGH VALUE OPPORTUNITIES
            </span>
          </div>
        </div>
      </header>

      <CompanySubNav />

      {sorted.length === 0 ? (
        <div
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            borderRadius: 16,
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'grid',
            gap: 14,
            placeItems: 'center',
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.04)',
              display: 'grid',
              placeItems: 'center',
              color: colors.muted,
            }}
          >
            <Sparkles size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 650, color: colors.text, margin: '0 0 6px' }}>
              NO OPPORTUNITIES REGISTERED
            </h2>
            <p style={{ margin: 0, color: colors.muted, fontSize: 13, maxWidth: 500, lineHeight: 1.6 }}>
              There are currently no discovered opportunities in this view. Run market scans or city rankings to populate autonomous intelligence.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <Link
              href="/markets"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                borderRadius: 8,
                background: colors.accent,
                color: '#1a1208',
                fontWeight: 700,
                fontSize: 12.5,
                textDecoration: 'none',
              }}
            >
              Explore Market Scans <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      ) : (
        <OpportunityIntelligenceBoard opportunities={sorted} />
      )}
    </div>
  );
}
