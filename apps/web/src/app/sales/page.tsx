import { colors, fonts } from '@umer/ui';
import { getOpportunities, getCompanyOverview } from '@/lib/control-api';
import { SalesPipelineKanban } from '@/components/os/SalesPipelineKanban';
import { SalesSubNav } from '@/components/os/SalesSubNav';
import { TrendingUp, DollarSign, Target, Award } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function SalesPage() {
  const [opportunities, overview] = await Promise.all([
    getOpportunities().catch(() => []),
    getCompanyOverview().catch(() => null),
  ]);

  const pipelineValue = overview?.revenueAndOutcomes.pipelineValue ?? 
    opportunities.reduce((acc, o) => acc + (o.estimatedValueMax ?? o.estimatedValueMin ?? 0), 0);
  const wonRevenue = overview?.revenueAndOutcomes.totalWonRevenue ?? 0;
  const activeDeals = opportunities.filter((o) => !['won', 'lost', 'rejected'].includes(o.status.toLowerCase())).length;
  const priceMultiplier = overview?.revenueAndOutcomes.recommendedPriceMultiplier ?? 1.0;

  return (
    <div style={{ display: 'grid', gap: 24, maxWidth: 1600, margin: '0 auto' }}>
      <SalesSubNav />

      {/* Top Sales Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        <div
          style={{
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: 12, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              Active Deals
            </div>
            <div style={{ fontFamily: fonts.mono, fontSize: 26, fontWeight: 700, color: colors.text, marginTop: 4 }}>
              {activeDeals}
            </div>
            <div style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>In active commercial cycle</div>
          </div>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(96, 165, 250, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa' }}>
            <Target size={22} />
          </div>
        </div>

        <div
          style={{
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: 12, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              Pipeline Value
            </div>
            <div style={{ fontFamily: fonts.mono, fontSize: 26, fontWeight: 700, color: colors.accent, marginTop: 4 }}>
              ${pipelineValue.toLocaleString()}
            </div>
            <div style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>Weighted deal projections</div>
          </div>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: colors.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.accent }}>
            <TrendingUp size={22} />
          </div>
        </div>

        <div
          style={{
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: 12, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              Closed Won
            </div>
            <div style={{ fontFamily: fonts.mono, fontSize: 26, fontWeight: 700, color: colors.success, marginTop: 4 }}>
              ${wonRevenue.toLocaleString()}
            </div>
            <div style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>Recognized contract bookings</div>
          </div>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(34, 197, 94, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.success }}>
            <Award size={22} />
          </div>
        </div>

        <div
          style={{
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: 12, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              Price Multiplier
            </div>
            <div style={{ fontFamily: fonts.mono, fontSize: 26, fontWeight: 700, color: colors.text, marginTop: 4 }}>
              {priceMultiplier.toFixed(2)}x
            </div>
            <div style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>Algorithmic yield index</div>
          </div>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(167, 139, 250, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a78bfa' }}>
            <DollarSign size={22} />
          </div>
        </div>
      </div>

      {/* Main Kanban Board */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, letterSpacing: '-0.02em', color: colors.text }}>
              Autonomous Sales Pipeline
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: colors.muted }}>
              Full lifecycle tracking across discovery, outreach, negotiation, and contract closing.
            </p>
          </div>
          <div style={{ fontSize: 12, color: colors.muted }}>
            Showing {opportunities.length} total qualified opportunities
          </div>
        </div>

        <SalesPipelineKanban opportunities={opportunities} />
      </section>
    </div>
  );
}
