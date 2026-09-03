import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Badge, Card, colors, fonts } from '@umer/ui';
import { getOpportunity, getWorkProjects } from '@/lib/control-api';
import { OpportunityJourney, recommendationLabel } from '@/components/os/OpportunityJourney';
import { ScoreBars } from '@/components/os/ScoreBars';
import { EntityNarrative, type NarrativeField } from '@/components/os/EntityNarrative';

export const dynamic = 'force-dynamic';

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [opportunity, projects] = await Promise.all([getOpportunity(id), getWorkProjects()]);
  if (!opportunity) notFound();

  const project = projects.find((p) => p.sourceOpportunityId === opportunity.id);
  const decidable = ['discovered', 'researching', 'validated', 'outreach_ready', 'in_sales'].includes(opportunity.status);
  const terminal = ['won', 'lost', 'rejected', 'converted_to_product'].includes(opportunity.status);

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
    </div>
  );
}
