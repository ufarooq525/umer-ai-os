import Link from 'next/link';
import { Card, colors, fonts, radii } from '@umer/ui';
import type { MorningBrief as MorningBriefModel } from '@/lib/morning-brief';
import { StatusBadge } from './StatusBadge';
import type { StatusTone } from './status';

function stateTone(state: MorningBriefModel['companyState']): StatusTone {
  if (state === 'broken') return 'failed';
  if (state === 'needs_you') return 'waiting';
  if (state === 'operating') return 'working';
  return 'idle';
}

function stateLabel(state: MorningBriefModel['companyState']): string {
  if (state === 'broken') return 'COMPANY BROKEN';
  if (state === 'needs_you') return 'NEEDS YOU';
  if (state === 'operating') return 'COMPANY OPERATING';
  return 'COMPANY IDLE';
}

function moneyLine(brief: MorningBriefModel): string {
  const { money } = brief;
  if (money.pipelineMin == null && money.pipelineMax == null) {
    return `${money.cashLabel}. Pipeline value unknown.`;
  }
  const currency = money.currency ?? 'USD';
  const min = money.pipelineMin != null ? `${currency} ${money.pipelineMin}` : '?';
  const max = money.pipelineMax != null ? `${currency} ${money.pipelineMax}` : '?';
  return `${money.cashLabel}. Pipeline estimate ${min}–${max} on ${money.promisingWithEstimate} scored opportunit${money.promisingWithEstimate === 1 ? 'y' : 'ies'} — not invoiced.`;
}

export function MorningBrief({ brief }: { brief: MorningBriefModel }) {
  return (
    <Card title="Morning brief">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <StatusBadge tone={stateTone(brief.companyState)} label={stateLabel(brief.companyState)} />
        <span style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.muted }}>
          API {brief.controlApi.status === 'up' ? 'up' : 'down'} · model {brief.llm.status}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, maxWidth: 760 }}>{brief.headline}</p>

      {brief.actions.length > 0 ? (
        <ol style={{ margin: '16px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
          {brief.actions.map((action, index) => (
            <li key={action.id}>
              <Link href={action.href} style={{ textDecoration: 'none', color: colors.text, display: 'block' }}>
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: radii.md,
                    border: `1px solid ${action.tone === 'critical' ? colors.danger : colors.border}`,
                    background: colors.surface,
                  }}
                >
                  <div style={{ fontSize: 11, fontFamily: fonts.mono, color: colors.muted, marginBottom: 4 }}>
                    {index + 1} / {brief.actions.length}
                    {action.tone === 'critical' ? ' · CRITICAL' : ''}
                  </div>
                  <strong style={{ fontSize: 14 }}>{action.label}</strong>
                  <div style={{ marginTop: 4, fontSize: 12, color: colors.muted, lineHeight: 1.45 }}>{action.reason}</div>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <p style={{ margin: '14px 0 0', fontSize: 13, color: colors.muted }}>No approvals, gates, or broken runtime right now.</p>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 10,
          marginTop: 16,
        }}
      >
        <BriefStat label="Last 24h completed" value={String(brief.last24h.completedRuns)} href="/agent-runs" />
        <BriefStat label="Last 24h failed" value={String(brief.last24h.failedRuns)} href="/agent-runs" warn={brief.last24h.failedRuns > 0} />
        <BriefStat label="Gates waiting" value={String(brief.waitingGates)} href="/gates" warn={brief.waitingGates > 0} />
        <BriefStat label="SEO to approve" value={String(brief.seoApprovals)} href="/seo" warn={brief.seoApprovals > 0} />
        <BriefStat label="Resolved today" value={String(brief.last24h.resolvedGates)} href="/gates" />
      </div>

      <p style={{ margin: '14px 0 0', fontSize: 13, color: colors.muted, lineHeight: 1.5 }}>{moneyLine(brief)}</p>

      {brief.topOpportunities.length > 0 ? (
        <div style={{ marginTop: 12, display: 'grid', gap: 6 }}>
          {brief.topOpportunities.map((opp) => (
            <Link
              key={opp.id}
              href={opp.href}
              style={{ fontSize: 13, color: colors.text, textDecoration: 'none', display: 'flex', justifyContent: 'space-between', gap: 12 }}
            >
              <span>{opp.title}</span>
              <span style={{ fontFamily: fonts.mono, color: colors.accent }}>{opp.score}</span>
            </Link>
          ))}
        </div>
      ) : null}
    </Card>
  );
}

function BriefStat({
  label,
  value,
  href,
  warn,
}: {
  label: string;
  value: string;
  href: string;
  warn?: boolean;
}) {
  return (
    <Link href={href} style={{ textDecoration: 'none', color: warn ? colors.warning : colors.text }}>
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: fonts.mono, letterSpacing: '-0.03em' }}>{value}</div>
      <div style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>{label}</div>
    </Link>
  );
}
