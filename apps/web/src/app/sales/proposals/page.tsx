import Link from 'next/link';
import { colors, fonts } from '@umer/ui';
import { getOpportunities, getCompanyOverview } from '@/lib/control-api';
import { SalesSubNav } from '@/components/os/SalesSubNav';
import { FileText, ArrowUpRight, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function SalesProposalsPage() {
  const [opportunities, overview] = await Promise.all([
    getOpportunities().catch(() => []),
    getCompanyOverview().catch(() => null),
  ]);

  // Real opportunities in late/commercial stages or with commercial value
  const commercialOpportunities = opportunities.filter(
    (o) =>
      ['outreach_ready', 'in_sales', 'selected_for_execution', 'won', 'project_created'].includes(
        o.status.toLowerCase(),
      ) || (o.estimatedValueMax && o.estimatedValueMax > 0),
  );

  const pendingApprovals = overview?.decisionsNeeded.filter((d) => d.type === 'deal_approval') ?? [];

  return (
    <div style={{ display: 'grid', gap: 24, maxWidth: 1400, margin: '0 auto' }}>
      <SalesSubNav />

      {/* Header */}
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.02em', color: colors.text }}>
          Commercial Proposals & Terms
        </h2>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: colors.muted }}>
          Review executive proposals, commercial terms, pricing models, and contract commitments.
        </p>
      </div>

      {/* Deal Approvals Banner if any exist */}
      {pendingApprovals.length > 0 && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 12,
            padding: 18,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: colors.danger, fontWeight: 650, fontSize: 14 }}>
            <AlertCircle size={18} />
            <span>{pendingApprovals.length} Commercial Deal Approvals Waiting for CEO Sign-Off</span>
          </div>
          <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
            {pendingApprovals.map((d) => (
              <div
                key={d.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: colors.surface,
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: `1px solid ${colors.border}`,
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: colors.text }}>{d.title}</div>
                  <div style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>Urgency: {d.urgency}</div>
                </div>
                <Link
                  href="/decisions"
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
                  Review Decision →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Proposals Grid */}
      {commercialOpportunities.length === 0 ? (
        <div
          style={{
            background: colors.surface,
            border: `1px dashed ${colors.border}`,
            borderRadius: 12,
            padding: '48px 24px',
            textAlign: 'center',
          }}
        >
          <FileText size={36} style={{ color: colors.muted, margin: '0 auto 12px', opacity: 0.6 }} />
          <h3 style={{ fontSize: 16, fontWeight: 650, color: colors.text, margin: 0 }}>No Proposals In Flight</h3>
          <p style={{ fontSize: 13, color: colors.muted, maxWidth: 440, margin: '8px auto 16px' }}>
            When market opportunities reach the proposal or contract stage, commercial packages will be listed here for approval.
          </p>
          <Link
            href="/company/opportunities"
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
            Explore Opportunities →
          </Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 16 }}>
          {commercialOpportunities.map((opp) => {
            const isWon = opp.status.toLowerCase() === 'won' || opp.status.toLowerCase() === 'project_created';
            const valueStr = opp.estimatedValueMax
              ? `$${opp.estimatedValueMax.toLocaleString()}`
              : opp.estimatedValueMin
              ? `$${opp.estimatedValueMin.toLocaleString()}`
              : 'Custom Scope';

            return (
              <div
                key={opp.id}
                style={{
                  background: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 12,
                  padding: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 16,
                  transition: 'border-color 0.15s ease',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <span
                      style={{
                        fontFamily: fonts.mono,
                        fontSize: 11,
                        fontWeight: 650,
                        padding: '3px 8px',
                        borderRadius: 6,
                        background: isWon ? 'rgba(34, 197, 94, 0.15)' : 'rgba(96, 165, 250, 0.15)',
                        color: isWon ? colors.success : '#60a5fa',
                        border: `1px solid ${isWon ? 'rgba(34, 197, 94, 0.3)' : 'rgba(96, 165, 250, 0.3)'}`,
                        textTransform: 'uppercase',
                      }}
                    >
                      {opp.status.replace(/_/g, ' ')}
                    </span>
                    <span style={{ fontFamily: fonts.mono, fontSize: 16, fontWeight: 700, color: colors.accent }}>
                      {valueStr}
                    </span>
                  </div>

                  <h3 style={{ fontSize: 16, fontWeight: 650, color: colors.text, margin: '12px 0 6px', letterSpacing: '-0.02em' }}>
                    {opp.title}
                  </h3>

                  <div style={{ fontSize: 12, color: colors.muted, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <span>Market: {opp.market}</span>
                    <span>·</span>
                    <span>Geo: {opp.geography}</span>
                    {opp.timeToRevenueDays != null && (
                      <>
                        <span>·</span>
                        <span>~{opp.timeToRevenueDays}d to rev</span>
                      </>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: 14,
                    borderTop: `1px solid ${colors.border}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: colors.muted }}>
                    {isWon ? (
                      <>
                        <CheckCircle2 size={14} style={{ color: colors.success }} />
                        <span style={{ color: colors.success }}>Executed Contract</span>
                      </>
                    ) : (
                      <>
                        <Clock size={14} style={{ color: colors.warning }} />
                        <span>Active Commercial Flow</span>
                      </>
                    )}
                  </div>
                  <Link
                    href={`/company/opportunities/${opp.id}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 12,
                      fontWeight: 600,
                      color: colors.accent,
                      textDecoration: 'none',
                    }}
                  >
                    <span>View Terms</span>
                    <ArrowUpRight size={13} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
