import Link from 'next/link';
import { colors, fonts } from '@umer/ui';
import { getCompanyOverview, getOpportunities, getWorkProjects } from '@/lib/control-api';
import { ArrowRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function FinancePage() {
  const [overview, opportunities, projects] = await Promise.all([
    getCompanyOverview().catch(() => null),
    getOpportunities().catch(() => []),
    getWorkProjects().catch(() => []),
  ]);


  const ro = overview?.revenueAndOutcomes ?? {
    totalWonRevenue: 0,
    recognizedRevenue: 0,
    pipelineValue: 0,
    averageMarginPercent: 0,
    averageCustomerHealthScore: 100,
    activeCustomersCount: 0,
    completedDeliveriesCount: 0,
    recommendedPriceMultiplier: 1.0,
  };

  const wonOpps = opportunities.filter((o) => o.status.toLowerCase() === 'won' || o.status.toLowerCase() === 'project_created');

  return (
    <div style={{ display: 'grid', gap: 28, maxWidth: 1400, margin: '0 auto' }}>
      {/* Executive Financial Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span
              style={{
                fontFamily: fonts.mono,
                fontSize: 11,
                fontWeight: 700,
                color: colors.accent,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              Autonomous Company Treasury
            </span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, letterSpacing: '-0.03em', color: colors.text }}>
            Financial Health & Revenue Lineage
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: colors.muted }}>
            Real-time balance sheet, recognized contracts, delivery margins, and revenue-to-code traceability.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <Link
            href="/sales"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              color: colors.text,
              textDecoration: 'none',
              padding: '8px 14px',
              borderRadius: 8,
              background: 'rgba(255, 255, 255, 0.05)',
              border: `1px solid ${colors.border}`,
            }}
          >
            <span>Inspect Sales</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      </div>

      {/* Top 4 Executive Financial Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        <div
          style={{
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            padding: 20,
          }}
        >
          <div style={{ fontSize: 12, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            Recognized Revenue
          </div>
          <div style={{ fontFamily: fonts.mono, fontSize: 32, fontWeight: 700, color: colors.success, marginTop: 6 }}>
            ${ro.recognizedRevenue.toLocaleString()}
          </div>
          <div style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>
            Earned from completed deliveries
          </div>
        </div>

        <div
          style={{
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            padding: 20,
          }}
        >
          <div style={{ fontSize: 12, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            Total Won Bookings
          </div>
          <div style={{ fontFamily: fonts.mono, fontSize: 32, fontWeight: 700, color: colors.text, marginTop: 6 }}>
            ${ro.totalWonRevenue.toLocaleString()}
          </div>
          <div style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>
            Signed contract commitments
          </div>
        </div>

        <div
          style={{
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            padding: 20,
          }}
        >
          <div style={{ fontSize: 12, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            Average Delivery Margin
          </div>
          <div style={{ fontFamily: fonts.mono, fontSize: 32, fontWeight: 700, color: colors.accent, marginTop: 6 }}>
            {ro.averageMarginPercent}%
          </div>
          <div style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>
            Net operational yield
          </div>
        </div>

        <div
          style={{
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            padding: 20,
          }}
        >
          <div style={{ fontSize: 12, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            Dynamic Price Multiplier
          </div>
          <div style={{ fontFamily: fonts.mono, fontSize: 32, fontWeight: 700, color: '#a78bfa', marginTop: 6 }}>
            {ro.recommendedPriceMultiplier.toFixed(2)}x
          </div>
          <div style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>
            Algorithmic pricing power index
          </div>
        </div>
      </div>

      {/* Revenue-to-Code Lineage Chain */}
      <section
        style={{
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: 14,
          padding: 24,
        }}
      >
        <div style={{ marginBottom: 18 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, letterSpacing: '-0.02em', color: colors.text }}>
            End-to-End Revenue Lineage Chain
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: colors.muted }}>
            How economic value flows through the company: from market discovery to code commits to recognized revenue.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 12,
            padding: '16px 0',
          }}
        >
          <div
            style={{
              padding: 16,
              borderRadius: 10,
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <div style={{ fontSize: 11, fontFamily: fonts.mono, color: colors.accent, fontWeight: 700 }}>1. MARKET & OPPS</div>
            <div style={{ fontSize: 15, fontWeight: 650, color: colors.text, marginTop: 4 }}>${ro.pipelineValue.toLocaleString()}</div>
            <div style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{opportunities.length} Total Opportunities</div>
          </div>

          <div
            style={{
              padding: 16,
              borderRadius: 10,
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <div style={{ fontSize: 11, fontFamily: fonts.mono, color: '#60a5fa', fontWeight: 700 }}>2. CONTRACT WON</div>
            <div style={{ fontSize: 15, fontWeight: 650, color: colors.text, marginTop: 4 }}>${ro.totalWonRevenue.toLocaleString()}</div>
            <div style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{wonOpps.length} Executed Deals</div>
          </div>

          <div
            style={{
              padding: 16,
              borderRadius: 10,
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <div style={{ fontSize: 11, fontFamily: fonts.mono, color: '#a78bfa', fontWeight: 700 }}>3. DELIVERY SPECS</div>
            <div style={{ fontSize: 15, fontWeight: 650, color: colors.text, marginTop: 4 }}>{projects.length} Projects Active</div>
            <div style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>Eng, QA, Security chain</div>
          </div>

          <div
            style={{
              padding: 16,
              borderRadius: 10,
              background: 'rgba(34, 197, 94, 0.05)',
              border: '1px solid rgba(34, 197, 94, 0.2)',
            }}
          >
            <div style={{ fontSize: 11, fontFamily: fonts.mono, color: colors.success, fontWeight: 700 }}>4. RECOGNIZED REVENUE</div>
            <div style={{ fontSize: 15, fontWeight: 650, color: colors.success, marginTop: 4 }}>${ro.recognizedRevenue.toLocaleString()}</div>
            <div style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{ro.completedDeliveriesCount} Signed Deliveries</div>
          </div>
        </div>
      </section>

      {/* Won Contracts & Value Attribution */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, letterSpacing: '-0.02em', color: colors.text }}>
            Contract Bookings & Deliverables
          </h2>
          <div style={{ fontSize: 12, color: colors.muted }}>
            Active Clients: {ro.activeCustomersCount} · Health Score: {ro.averageCustomerHealthScore}%
          </div>
        </div>

        {wonOpps.length === 0 ? (
          <div
            style={{
              background: colors.surface,
              border: `1px dashed ${colors.border}`,
              borderRadius: 12,
              padding: '40px 24px',
              textAlign: 'center',
              color: colors.muted,
              fontSize: 13,
            }}
          >
            No closed-won deals in database yet. Deals progressing through the sales pipeline will be reflected in recognized revenue upon delivery sign-off.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {wonOpps.map((opp) => (
              <div
                key={opp.id}
                style={{
                  background: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 10,
                  padding: '16px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 14,
                }}
              >
                <div>
                  <div style={{ fontSize: 15, fontWeight: 650, color: colors.text }}>{opp.title}</div>
                  <div style={{ fontSize: 12, color: colors.muted, marginTop: 3 }}>
                    Market: {opp.market} · Geo: {opp.geography}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: colors.muted, textTransform: 'uppercase' }}>Booked Value</div>
                    <div style={{ fontFamily: fonts.mono, fontSize: 16, fontWeight: 700, color: colors.accent }}>
                      ${(opp.estimatedValueMax ?? opp.estimatedValueMin ?? 0).toLocaleString()}
                    </div>
                  </div>
                  <Link
                    href={`/company/opportunities/${opp.id}`}
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: colors.accent,
                      textDecoration: 'none',
                      padding: '6px 12px',
                      borderRadius: 6,
                      background: colors.accentSoft,
                    }}
                  >
                    View Terms →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
