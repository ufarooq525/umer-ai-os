import { NextRequest, NextResponse } from 'next/server';
import { buildBusinessIdentity, createMySqlOpportunityPersistence } from '@umer/opportunity-intelligence';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const persistence = createMySqlOpportunityPersistence();
    const requestedRunId = request.nextUrl.searchParams.get('runId');
    const latestRun = requestedRunId ? undefined : await persistence.getLatestRun();
    const runId = requestedRunId ?? latestRun?.runId;
    if (!runId) return NextResponse.json({ error: 'No persisted opportunity runs found' }, { status: 404 });

    const [candidates, problems, events] = await Promise.all([
      persistence.listDiscoveryCandidates(runId),
      persistence.listProblems({ runId }),
      persistence.listEvents(runId),
    ]);

    const nicheId = candidates[0]?.nicheId ?? latestRun?.nicheId;
    const opportunities = nicheId ? await persistence.listOpportunities(nicheId) : [];
    const outreach = nicheId ? await persistence.listOutreachDrafts({ nicheId }) : [];
    const evidenceIds = [...new Set([
      ...problems.flatMap((item) => item.evidenceRefs),
      ...opportunities.flatMap((item) => item.evidenceRefs),
      ...outreach.flatMap((item) => item.evidenceRefs),
    ])];
    const evidence = await persistence.listEvidence(evidenceIds);

    const businesses = await Promise.all(candidates.map(async (candidate) => {
      const identity = buildBusinessIdentity({
        externalId: candidate.externalId,
        name: candidate.name,
        websiteUrl: candidate.websiteUrl,
        geography: candidate.geography,
      });
      const business = await persistence.getBusiness(identity.id);
      const businessProblems = problems.filter((item) => item.businessId === identity.id);
      const businessOpportunities = opportunities.filter((item) => item.businessId === identity.id);
      const businessOutreach = outreach.filter((item) => item.businessId === identity.id);
      const refs = new Set([
        ...businessProblems.flatMap((item) => item.evidenceRefs),
        ...businessOpportunities.flatMap((item) => item.evidenceRefs),
        ...businessOutreach.flatMap((item) => item.evidenceRefs),
      ]);
      return {
        ...candidate,
        business: business ?? null,
        problems: businessProblems,
        opportunities: businessOpportunities,
        outreach: businessOutreach,
        evidence: evidence.filter((item) => refs.has(item.id)),
      };
    }));

    return NextResponse.json({
      runId,
      nicheId: nicheId ?? null,
      businesses,
      problems,
      evidence,
      opportunities,
      outreach,
      events,
    }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
