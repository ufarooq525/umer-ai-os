import {
  getBusiness,
  getNicheEvents,
  getNicheProspects,
  getOpportunity,
  getWorkProjects,
  type BusinessDetail,
  type NicheProspectSummary,
  type OpportunityRecord,
  type OutreachDraftRecord,
  type WorkProjectRecord,
} from './control-api';
import {
  deriveContactChannels,
  deriveOpportunityActivity,
  deriveOutreachReadiness,
  deriveProspectFit,
  type ContactChannel,
  type OpportunityActivityEntry,
  type OutreachReadiness,
  type ProspectFit,
} from './commercial-intelligence';
import { deriveSendProposal, type SendProposal } from './send-proposal';
import { deriveOperatorBrief, type OperatorBrief } from './operator-brief';

type NarrativeField = { key: 'WHY' | 'GOAL' | 'NOW' | 'NEXT' | 'RESULT' | 'PROBLEM'; value: string };

function recommendationLabel(recommendation: string): string {
  const labels: Record<string, string> = {
    reject: 'Not worth pursuing based on current evidence.',
    watch: 'Worth monitoring, not yet strong enough to act on.',
    research_more: 'Needs more research before a decision can be made.',
    outreach_ready: 'Ready to reach out to prospects and validate willingness to pay.',
    product_candidate: 'Strong enough to justify building a product for it.',
  };
  return labels[recommendation] ?? recommendation;
}

export type OpportunityDetailModel = {
  opportunity: OpportunityRecord;
  project: WorkProjectRecord | null;
  businessDetail: BusinessDetail | null;
  contactChannels: ContactChannel[];
  readiness: OutreachReadiness | null;
  fit: ProspectFit | null;
  otherOpportunities: OpportunityRecord[];
  otherProspects: NicheProspectSummary[];
  activity: OpportunityActivityEntry[];
  proposal: SendProposal;
  operatorBrief: OperatorBrief | null;
  filedDrafts: OutreachDraftRecord[];
  fields: NarrativeField[];
  decidable: boolean;
};

export async function loadOpportunityDetail(id: string, opts?: { includeNeighbors?: boolean }): Promise<OpportunityDetailModel | null> {
  const includeNeighbors = opts?.includeNeighbors ?? true;
  const [opportunity, projects] = await Promise.all([getOpportunity(id), getWorkProjects()]);
  if (!opportunity) return null;

  const project = projects.find((p) => p.sourceOpportunityId === opportunity.id) ?? null;
  const decidable = ['discovered', 'researching', 'validated', 'outreach_ready', 'in_sales'].includes(opportunity.status);
  const terminal = ['won', 'lost', 'rejected', 'converted_to_product'].includes(opportunity.status);

  const businessDetail = opportunity.businessId ? await getBusiness(opportunity.businessId) : null;
  const runId = businessDetail?.runId ?? undefined;
  const [nicheProspects, nicheEvents] = includeNeighbors
    ? await Promise.all([
        opportunity.nicheId ? getNicheProspects(opportunity.nicheId, runId) : Promise.resolve({ runId: null, prospects: [] }),
        opportunity.nicheId ? getNicheEvents(opportunity.nicheId, runId) : Promise.resolve({ runId: null, events: [] }),
      ])
    : [
        { runId: null, prospects: [] as NicheProspectSummary[] },
        { runId: null, events: [] },
      ];

  const contactChannels = businessDetail ? deriveContactChannels(businessDetail.business, businessDetail.discoveryCandidate) : [];
  const readiness = businessDetail
    ? deriveOutreachReadiness(businessDetail.business, contactChannels, businessDetail.evidence.length, businessDetail.outreach)
    : null;
  const fit = businessDetail ? deriveProspectFit(businessDetail.opportunities) : null;
  const otherOpportunities = businessDetail?.opportunities.filter((o) => o.id !== opportunity.id) ?? [];
  const otherProspects = nicheProspects.prospects.filter((p) => p.businessId !== opportunity.businessId);
  const activity = deriveOpportunityActivity(nicheEvents.events);
  const email =
    businessDetail?.business.sourceRefs?.find((r) => r.startsWith('email:'))?.slice('email:'.length) ?? null;
  const proposal = deriveSendProposal({
    opportunity,
    businessName: businessDetail?.business.name ?? null,
    website: businessDetail?.business.website ?? businessDetail?.discoveryCandidate?.websiteUrl ?? null,
    email,
    problems: businessDetail?.problems,
    evidence: businessDetail?.evidence,
  });

  const filedDrafts = (businessDetail?.outreach ?? []).filter((d) => d.opportunityId === opportunity.id);
  const operatorBrief = businessDetail
    ? deriveOperatorBrief({
        opportunity,
        businessName: businessDetail.business.name,
        lastResearchedAt: businessDetail.business.lastResearchedAt ?? null,
        contactChannels,
        problems: businessDetail.problems,
        evidence: businessDetail.evidence,
        outreachDrafts: filedDrafts,
      })
    : null;

  const fields: NarrativeField[] = [
    {
      key: 'WHY',
      value: `${opportunity.problemIds?.length ?? 0} problem(s) identified, backed by ${opportunity.evidenceRefs?.length ?? 0} piece(s) of evidence.`,
    },
    ...(opportunity.score ? [{ key: 'GOAL' as const, value: recommendationLabel(opportunity.score.recommendation) }] : []),
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

  return {
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
    decidable,
  };
}
