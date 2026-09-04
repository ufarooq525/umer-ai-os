import Link from 'next/link';
import { Badge, Card, colors, fonts } from '@umer/ui';
import { OpportunityJourney } from './OpportunityJourney';
import { ScoreBars } from './ScoreBars';
import { EntityNarrative } from './EntityNarrative';
import { ContactChannelCard } from './ContactChannelCard';
import { ProspectFitCard } from './ProspectFitCard';
import { ProspectSummaryCard } from './ProspectSummaryCard';
import { OpportunityActivityFeed } from './OpportunityActivityFeed';
import { SendProposalCard } from './SendProposalCard';
import { OperatorBriefCard } from './OperatorBriefCard';
import { FiledDraftsCard } from './FiledDraftsCard';
import type { OpportunityDetailModel } from '@/lib/opportunity-detail';

export function OpportunityDetailBody({
  model,
  compact = false,
}: {
  model: OpportunityDetailModel;
  compact?: boolean;
}) {
  const {
    opportunity,
    project,
    businessDetail,
    contactChannels,
    readiness,
    fit,
    otherOpportunities,
    otherProspects,
    activity,
    proposal,
    operatorBrief,
    filedDrafts,
    fields,
  } = model;

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <header>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: compact ? 20 : 'clamp(1.4rem, 2.4vw, 1.9rem)', fontWeight: 650, margin: 0, letterSpacing: '-0.03em' }}>
            {opportunity.title}
          </h2>
          {opportunity.score ? (
            <div style={{ fontFamily: fonts.mono, fontSize: compact ? 22 : 28, fontWeight: 700, color: colors.accent }}>
              {opportunity.score.overall}
              <span style={{ fontSize: 13, color: colors.muted }}>/100</span>
            </div>
          ) : null}
        </div>
        <p style={{ margin: '8px 0 0', color: colors.muted, fontSize: 13 }}>
          {opportunity.geography} · {opportunity.market} · {opportunity.type}
          {opportunity.estimatedValueMin != null
            ? ` · ${opportunity.currency ?? 'USD'} ${opportunity.estimatedValueMin}-${opportunity.estimatedValueMax}`
            : ''}
          {opportunity.timeToRevenueDays != null ? ` · ~${opportunity.timeToRevenueDays}d to revenue` : ''}
        </p>
        <div style={{ marginTop: 12 }}>
          <OpportunityJourney status={opportunity.status} />
        </div>
      </header>

      {operatorBrief ? <OperatorBriefCard brief={operatorBrief} /> : null}
      <EntityNarrative fields={fields} />
      <SendProposalCard proposal={proposal} />
      <FiledDraftsCard drafts={filedDrafts} />

      {opportunity.score ? (
        <Card title="Score breakdown">
          <ScoreBars score={opportunity.score} />
        </Card>
      ) : null}

      <Card title="Relationships">
        <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
          <div>
            <span style={{ color: colors.muted }}>Source: </span>
            <Badge>{opportunity.type}</Badge>
          </div>
          <div>
            <span style={{ color: colors.muted }}>Project: </span>
            {project ? (
              <Link href={`/company/projects/${project.projectId}`} style={{ color: colors.accent }}>
                {project.name}
              </Link>
            ) : (
              <span style={{ color: colors.muted }}>none yet</span>
            )}
          </div>
        </div>
      </Card>

      <section>
        <h3 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.muted, margin: '0 0 12px' }}>
          Target Prospect
        </h3>
        {!opportunity.businessId ? (
          <Card>
            <p style={{ margin: 0, fontSize: 13, color: colors.muted }}>This opportunity is not yet linked to a specific business record.</p>
          </Card>
        ) : !businessDetail ? (
          <Card>
            <p style={{ margin: 0, fontSize: 13, color: colors.muted }}>
              Business record {opportunity.businessId} referenced by this opportunity could not be found.
            </p>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ flex: '1 1 320px', minWidth: 0 }}>
              <ContactChannelCard channels={contactChannels} />
            </div>
            <div style={{ flex: '1 1 320px', minWidth: 0 }}>
              {fit && readiness ? <ProspectFitCard fit={fit} readiness={readiness} /> : null}
            </div>
          </div>
        )}
        {businessDetail ? (
          <p style={{ margin: '10px 0 0' }}>
            <Link href={`/company/prospects/${businessDetail.business.id}`} style={{ fontSize: 12, color: colors.accent }}>
              View full prospect record →
            </Link>
          </p>
        ) : null}
      </section>

      {otherOpportunities.length > 0 ? (
        <Card title={`Other opportunities for ${businessDetail?.business.name}`}>
          <div style={{ display: 'grid', gap: 6 }}>
            {otherOpportunities.map((o) => (
              <Link
                key={o.id}
                href={`/company/opportunities?open=${o.id}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
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

      {!compact && otherProspects.length > 0 ? (
        <section>
          <h3 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.muted, margin: '0 0 8px' }}>
            Other prospects discovered in this research run
          </h3>
          <p style={{ margin: '0 0 12px', fontSize: 12, color: colors.muted }}>
            These businesses were found in the same market research run — not necessarily prospects for this specific opportunity.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            {otherProspects.map((p) => (
              <ProspectSummaryCard key={p.businessId} prospect={p} />
            ))}
          </div>
        </section>
      ) : null}

      {activity.length > 0 ? (
        <Card title="Research Activity">
          <OpportunityActivityFeed entries={activity} />
        </Card>
      ) : null}
    </div>
  );
}
