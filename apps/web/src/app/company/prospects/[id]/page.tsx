import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Card, colors, fonts } from '@umer/ui';
import { getBusiness } from '@/lib/control-api';
import { deriveContactChannels, deriveOutreachReadiness, deriveProspectFit, deriveSocialChannels } from '@/lib/commercial-intelligence';
import { ContactChannelCard } from '@/components/os/ContactChannelCard';
import { ProspectFitCard } from '@/components/os/ProspectFitCard';
import { StatusBadge } from '@/components/os/StatusBadge';
import { formatRelativeTime } from '@/components/os/format';
import type { StatusTone } from '@/components/os/status';

const OUTREACH_STATUS_TONE: Record<string, StatusTone> = {
  drafted: 'waiting',
  ready: 'waiting',
  sent: 'working',
  replied: 'thinking',
  converted: 'completed',
  rejected: 'failed',
};

export const dynamic = 'force-dynamic';

const STRENGTH_COLOR: Record<string, string> = {
  weak: colors.muted,
  moderate: colors.warning,
  strong: colors.accent,
  verified: colors.success,
};

export default async function ProspectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getBusiness(id);
  if (!detail) notFound();

  const { business, discoveryCandidate, opportunities, outreach, evidence, problems } = detail;
  const contactChannels = [...deriveContactChannels(business, discoveryCandidate), ...deriveSocialChannels(evidence)];
  const fit = deriveProspectFit(opportunities);
  const readiness = deriveOutreachReadiness(business, contactChannels, evidence.length, outreach);
  const primaryDraft = outreach[0];

  const nextAction =
    readiness.status === 'ready'
      ? 'Review the prepared outreach draft before any contact is made.'
      : (readiness.blockers[0] ?? 'Continue prospect research.');

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <header>
        <Link href="/company/opportunities" style={{ fontSize: 12, color: colors.muted, textDecoration: 'none' }}>
          ← Opportunities
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 'clamp(1.4rem, 2.4vw, 1.9rem)', fontWeight: 650, margin: 0, letterSpacing: '-0.03em' }}>
              {business.name}
            </h1>
            <p style={{ margin: '4px 0 0', color: colors.muted, fontSize: 13 }}>
              {business.geography}
              {business.industry ? ` · ${business.industry}` : ''}
            </p>
          </div>
          {fit.score != null ? (
            <div style={{ fontFamily: fonts.mono, fontSize: 24, fontWeight: 700, color: colors.accent }}>
              {fit.score}
              <span style={{ fontSize: 12, color: colors.muted }}>/100</span>
            </div>
          ) : null}
        </div>
        <p style={{ margin: '10px 0 0', fontSize: 11, color: colors.muted, fontFamily: fonts.mono }}>
          discovered {formatRelativeTime(business.discoveredAt)}
          {business.lastResearchedAt ? ` · last researched ${formatRelativeTime(business.lastResearchedAt)}` : ''}
        </p>
      </header>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <ContactChannelCard channels={contactChannels} />
        </div>
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <ProspectFitCard fit={fit} readiness={readiness} />
        </div>
      </div>

      <Card title="Commercial Next Action">
        <p style={{ margin: 0, fontSize: 14, color: colors.text, lineHeight: 1.5 }}>{nextAction}</p>
      </Card>

      {evidence.length > 0 ? (
        <Card title={`Evidence (${evidence.length})`}>
          <div style={{ display: 'grid', gap: 10 }}>
            {evidence.map((item) => (
              <div key={item.id} style={{ padding: '10px 0', borderBottom: `1px solid ${colors.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: 13 }}>{item.title}</strong>
                  <span
                    style={{
                      fontFamily: fonts.mono,
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      color: STRENGTH_COLOR[item.strength] ?? colors.muted,
                    }}
                  >
                    {item.strength}
                  </span>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: colors.muted }}>{item.observation}</p>
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 11, color: colors.accent, wordBreak: 'break-all' }}
                >
                  {item.sourceUrl}
                </a>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {opportunities.length > 0 ? (
        <Card title={`Opportunities for this business (${opportunities.length})`}>
          <div style={{ display: 'grid', gap: 6 }}>
            {opportunities.map((o) => (
              <Link
                key={o.id}
                href={`/company/opportunities/${o.id}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 13,
                  color: colors.text,
                  textDecoration: 'none',
                  padding: '6px 0',
                  borderBottom: `1px solid ${colors.border}`,
                }}
              >
                <span>{o.title}</span>
                {o.score ? <span style={{ fontFamily: fonts.mono, color: colors.accent, fontSize: 12 }}>{o.score.overall}</span> : null}
              </Link>
            ))}
          </div>
        </Card>
      ) : null}

      {problems.length > 0 ? (
        <Card title={`Detected problems (${problems.length})`}>
          <div style={{ display: 'grid', gap: 6 }}>
            {problems.map((p) => (
              <div key={p.id} style={{ fontSize: 13, padding: '6px 0', borderBottom: `1px solid ${colors.border}` }}>
                {p.statement}
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {primaryDraft ? (
        <Card title="Prepared Outreach">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <StatusBadge tone={OUTREACH_STATUS_TONE[primaryDraft.status] ?? 'idle'} label={primaryDraft.status.toUpperCase()} />
            <span style={{ fontSize: 12, color: colors.muted, fontFamily: fonts.mono }}>{primaryDraft.channel}</span>
          </div>
          <p style={{ margin: '0 0 8px', fontSize: 12, color: colors.warning }}>
            Prepared, not sent — no message has left this system.
          </p>
          <p style={{ margin: 0, fontSize: 13, color: colors.text, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{primaryDraft.body}</p>
          <p style={{ margin: '8px 0 0', fontSize: 11, color: colors.muted }}>
            Recipient: {primaryDraft.recipient ?? 'unknown'}
          </p>
        </Card>
      ) : null}
    </div>
  );
}
