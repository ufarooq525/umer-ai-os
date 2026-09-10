import Link from 'next/link';
import { Users, ArrowRight } from 'lucide-react';
import { colors, fonts } from '@umer/ui';
import { getNiches, getNicheProspects, type NicheProspectSummary } from '@/lib/control-api';
import { ProspectSummaryCard } from '@/components/os/ProspectSummaryCard';
import { PagedChildren } from '@/components/os/PagedChildren';
import { CompanySubNav } from '@/components/os/CompanySubNav';

export const dynamic = 'force-dynamic';

async function settled<T>(task: Promise<T>, fallback: T): Promise<T> {
  try {
    return await task;
  } catch {
    return fallback;
  }
}

export default async function ProspectsPage() {
  const niches = await settled(getNiches(), []);
  const byNiche = await Promise.all(
    niches.map((niche) => settled(getNicheProspects(niche.id), { runId: null, prospects: [] as NicheProspectSummary[] })),
  );

  // A business can surface under more than one niche run — keep the first (most complete) record per business.
  const seen = new Map<string, NicheProspectSummary>();
  for (const { prospects } of byNiche) {
    for (const prospect of prospects) {
      if (!seen.has(prospect.businessId)) seen.set(prospect.businessId, prospect);
    }
  }
  const all = [...seen.values()].sort((a, b) => b.bestScore - a.bestScore);
  const withContact = all.filter((p) => p.hasContactChannel).length;

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <header>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 'clamp(1.5rem, 2.6vw, 2.1rem)', fontWeight: 650, margin: 0, letterSpacing: '-0.035em', color: '#ffffff' }}>
              Prospects ({all.length})
            </h1>
            <p style={{ margin: '8px 0 0', color: colors.muted, fontSize: 14 }}>
              Every business discovered across all market research runs, ranked by opportunity score.
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
                background: withContact > 0 ? 'rgba(93, 206, 160, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                color: withContact > 0 ? colors.success : colors.muted,
                border: `1px solid ${withContact > 0 ? 'rgba(93, 206, 160, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
              }}
            >
              {withContact} WITH CONTACT CHANNEL
            </span>
            <span
              style={{
                fontFamily: fonts.mono,
                fontSize: 12,
                fontWeight: 650,
                padding: '4px 10px',
                borderRadius: 8,
                background: 'rgba(255, 255, 255, 0.04)',
                color: colors.muted,
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              {all.length - withContact} NO CONTACT CHANNEL
            </span>
          </div>
        </div>
      </header>

      <CompanySubNav />

      {all.length === 0 ? (
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
            <Users size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 650, color: colors.text, margin: '0 0 6px' }}>
              NO PROSPECTS DISCOVERED YET
            </h2>
            <p style={{ margin: 0, color: colors.muted, fontSize: 13, maxWidth: 500, lineHeight: 1.6 }}>
              Prospects are populated by market research runs. Run a market scan to discover businesses in a niche.
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
        <PagedChildren pageSize={24} minItemWidth={260}>
          {all.map((prospect) => (
            <ProspectSummaryCard key={prospect.businessId} prospect={prospect} />
          ))}
        </PagedChildren>
      )}
    </div>
  );
}
