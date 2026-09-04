import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Badge, Card, colors, fonts } from '@umer/ui';
import { getBusiness, getNicheEvents, getNicheProspects, getOpportunity, getWorkProjects } from '@/lib/control-api';
import { OpportunityJourney, recommendationLabel } from '@/components/os/OpportunityJourney';
import { ScoreBars } from '@/components/os/ScoreBars';
import { EntityNarrative, type NarrativeField } from '@/components/os/EntityNarrative';
import { ContactChannelCard } from '@/components/os/ContactChannelCard';
import { ProspectFitCard } from '@/components/os/ProspectFitCard';
import { ProspectSummaryCard } from '@/components/os/ProspectSummaryCard';
import { OpportunityActivityFeed } from '@/components/os/OpportunityActivityFeed';
import { deriveContactChannels, deriveOpportunityActivity, deriveOutreachReadiness, deriveProspectFit } from '@/lib/commercial-intelligence';

export const dynamic = 'force-dynamic';

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [opportunity, projects] = await Promise.all([getOpportunity(id), getWorkProjects()]);
  if (!opportunity) notFound();

  const project = projects.find((p) => p.sourceOpportunityId === opportunity.id);
  const decidable = ['discovered', 'researching', 'validated', 'outreach_ready', 'in_sales'].includes(opportunity.status);
  const terminal = ['won', 'lost', 'rejected', 'converted_to_product'].includes(opportunity.status);

  const businessDetail = opportunity.businessId ? await getBusiness(opportunity.businessId) : null;
  const runId = businessDetail?.runId ?? undefined;
  const [nicheProspects, nicheEvents] = await Promise.all([
    opportunity.nicheId ? getNicheProspects(opportunity.nicheId, runId) : Promise.resolve({ runId: null, prospects: [] }),
    opportunity.nicheId ? getNicheEvents(opportunity.nicheId, runId) : Promise.resolve({ runId: null, events: [] }),
  ]);

  const contactChannels = businessDetail ? deriveContactChannels(businessDetail.business, businessDetail.discoveryCandidate) : [];
  const readiness = businessDetail
    ? deriveOutreachReadiness(businessDetail.business, contactChannels, businessDetail.evidence.length, businessDetail.outreach)
    : null;
  const fit = businessDetail ? deriveProspectFit(businessDetail.opportunities) : null;
  const otherOpportunities = businessDetail?.opportunities.filter((o) => o.id !== opportunity.id) ?? [];
  const otherProspects = nicheProspects.prospects.filter((p) => p.businessId !== opportunity.businessId);
  const activity = deriveOpportunityActivity(nicheEvents.events);

  const fields: NarrativeField[] = [
    {
      key: 'WHY',
      value: `${opportunity.problemIds?.length ?? 0} problem(s) identified, backed by ${opportunity.evidenceRefs?.length ?? 0} piece(s) of evidence.`,
    },
    ...(opportunity.score
      ? [{ key: 'GOAL' as const, value: recommendationLabel(opportunity.score.recommendation) }]
      : []),
    { key: 'NOW', value: `Status: ${opportunity.status}` },
    {
      key: 'NEXT',
      value: decidable
        ? 'Awaiting CEO decision — select or reject it in Decisions.'
        : opportunity.status === 'selected_for_execution'
          ? 'Selected — ready for a project to be created.'
          : project
            ? `Tracked in project "${project.name}".`
            : terminal
              ? 'Closed — no further action.'
              : 'No action pending.',
    },
    {
      key: 'RESULT',
      value: project ? `Project "${project.name}" — ${project.status}` : 'No project created from this opportunity yet.',
    },
    { key: 'PROBLEM', value: 'None' },
  ];

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <header>
        <Link href="/company/opportunities" style={{ fontSize: 12, color: colors.muted, textDecoration: 'none' }}>
          ← Opportunities
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 'clamp(1.4rem, 2.4vw, 1.9rem)', fontWeight: 650, margin: 0, letterSpacing: '-0.03em' }}>
            {opportunity.title}
          </h1>
          {opportunity.score ? (
            <div style={{ fontFamily: fonts.mono, fontSize: 28, fontWeight: 700, color: colors.accent }}>
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

      <EntityNarrative fields={fields} />

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
        <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.muted, margin: '0 0 12px' }}>
          Target Prospect
        </h2>
        {!opportunity.businessId ? (
          <Card>
            <p style={{ margin: 0, fontSize: 13, color: colors.muted }}>
              This opportunity is not yet linked to a specific business record.
            </p>
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
                href={`/company/opportunities/${o.id}`}
                style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: colors.text, textDecoration: 'none', padding: '6px 0', borderBottom: `1px solid ${colors.border}` }}
              >
                <span>{o.title}</span>
                {o.score ? <span style={{ fontFamily: fonts.mono, color: colors.accent, fontSize: 12 }}>{o.score.overall}</span> : null}
              </Link>
            ))}
          </div>
        </Card>
      ) : null}

      {otherProspects.length > 0 ? (
        <section>
          <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.muted, margin: '0 0 8px' }}>
            Other prospects discovered in this research run
          </h2>
          <p style={{ margin: '0 0 12px', fontSize: 12, color: colors.muted }}>
            These businesses were found in the same market research run — not necessarily prospects for this specific
            opportunity.
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
