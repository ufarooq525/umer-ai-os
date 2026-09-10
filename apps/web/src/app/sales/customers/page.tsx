import Link from 'next/link';
import { colors, fonts } from '@umer/ui';
import { getCustomers, getCompanyOverview } from '@/lib/control-api';
import { SalesSubNav } from '@/components/os/SalesSubNav';
import { Users, HeartPulse, Activity, ExternalLink } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function SalesCustomersPage() {
  const [customers, overview] = await Promise.all([
    getCustomers().catch(() => []),
    getCompanyOverview().catch(() => null),
  ]);

  const activeCount = overview?.revenueAndOutcomes.activeCustomersCount ?? customers.length;
  const avgHealth = overview?.revenueAndOutcomes.averageCustomerHealthScore ?? 
    (customers.length > 0 ? Math.round(customers.reduce((acc, c) => acc + (c.healthScore ?? 100), 0) / customers.length) : 100);

  return (
    <div style={{ display: 'grid', gap: 24, maxWidth: 1400, margin: '0 auto' }}>
      <SalesSubNav />

      {/* Header & KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
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
              Active Accounts
            </div>
            <div style={{ fontFamily: fonts.mono, fontSize: 26, fontWeight: 700, color: colors.text, marginTop: 4 }}>
              {activeCount}
            </div>
            <div style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>Contracted clients</div>
          </div>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(96, 165, 250, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa' }}>
            <Users size={22} />
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
              Avg Account Health
            </div>
            <div style={{ fontFamily: fonts.mono, fontSize: 26, fontWeight: 700, color: avgHealth >= 80 ? colors.success : colors.warning, marginTop: 4 }}>
              {avgHealth}%
            </div>
            <div style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>Retention & satisfaction</div>
          </div>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(34, 197, 94, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.success }}>
            <HeartPulse size={22} />
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
              Completed Deliveries
            </div>
            <div style={{ fontFamily: fonts.mono, fontSize: 26, fontWeight: 700, color: colors.accent, marginTop: 4 }}>
              {overview?.revenueAndOutcomes.completedDeliveriesCount ?? 0}
            </div>
            <div style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>Signed client sign-offs</div>
          </div>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: colors.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.accent }}>
            <Activity size={22} />
          </div>
        </div>
      </div>

      {/* Customers List */}
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 14px', letterSpacing: '-0.02em', color: colors.text }}>
          Contracted Accounts
        </h2>

        {customers.length === 0 ? (
          <div
            style={{
              background: colors.surface,
              border: `1px dashed ${colors.border}`,
              borderRadius: 12,
              padding: '48px 24px',
              textAlign: 'center',
            }}
          >
            <Users size={36} style={{ color: colors.muted, margin: '0 auto 12px', opacity: 0.6 }} />
            <h3 style={{ fontSize: 16, fontWeight: 650, color: colors.text, margin: 0 }}>No Client Accounts Established Yet</h3>
            <p style={{ fontSize: 13, color: colors.muted, maxWidth: 460, margin: '8px auto 16px' }}>
              When commercial opportunities are won and onboarding starts, account records with delivery milestones and health metrics will appear here.
            </p>
            <Link
              href="/sales"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                fontWeight: 600,
                color: colors.accent,
                textDecoration: 'none',
                padding: '8px 16px',
                borderRadius: 6,
                background: colors.accentSoft,
                border: `1px solid rgba(255, 255, 255, 0.08)`,
              }}
            >
              Inspect Sales Pipeline →
            </Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {customers.map((c) => (
              <div
                key={c.id}
                style={{
                  background: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 10,
                  padding: '16px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 16,
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 16, fontWeight: 650, color: colors.text }}>{c.companyName}</span>
                    <span
                      style={{
                        fontFamily: fonts.mono,
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: c.status === 'active' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(232, 160, 84, 0.15)',
                        color: c.status === 'active' ? colors.success : colors.accent,
                        textTransform: 'uppercase',
                      }}
                    >
                      {c.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: colors.muted, marginTop: 4, display: 'flex', gap: 12 }}>
                    <span>Active Projects: {c.activeProjectIds?.length ?? 0}</span>
                    {c.mrr ? <span>MRR: ${c.mrr.toLocaleString()}</span> : null}
                    {c.lifetimeValue ? <span>LTV: ${c.lifetimeValue.toLocaleString()}</span> : null}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Health Score
                    </div>
                    <div style={{ fontFamily: fonts.mono, fontSize: 18, fontWeight: 700, color: c.healthScore >= 80 ? colors.success : colors.warning }}>
                      {c.healthScore}%
                    </div>
                  </div>

                  <Link
                    href={`/company/graph?customerId=${encodeURIComponent(c.id)}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 12,
                      fontWeight: 600,
                      color: colors.accent,
                      textDecoration: 'none',
                      padding: '6px 12px',
                      borderRadius: 6,
                      background: colors.accentSoft,
                    }}
                  >
                    <span>Account Graph</span>
                    <ExternalLink size={12} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
