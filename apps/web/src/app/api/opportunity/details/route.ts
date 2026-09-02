import { NextRequest, NextResponse } from 'next/server';
import { createMySqlOpportunityPersistence } from '@umer/opportunity-intelligence';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const runId = request.nextUrl.searchParams.get('runId');
  if (!runId) return NextResponse.json({ error: 'runId is required' }, { status: 400 });

  try {
    const persistence = createMySqlOpportunityPersistence();
    const [candidates, problems, events] = await Promise.all([
      persistence.listDiscoveryCandidates(runId),
      persistence.listProblems({ runId }),
      persistence.listEvents(runId),
    ]);

    const nicheId = candidates[0]?.nicheId ?? (await persistence.getLatestRun())?.nicheId;
    const opportunities = nicheId ? await persistence.listOpportunities(nicheId) : [];
    const outreach = nicheId ? await persistence.listOutreachDrafts({ nicheId }) : [];
    const evidenceIds = [...new Set([
      ...problems.flatMap((item) => item.evidenceRefs),
      ...opportunities.flatMap((item) => item.evidenceRefs),
      ...outreach.flatMap((item) => item.evidenceRefs),
    ])];
    const evidence = await persistence.listEvidence(evidenceIds);
    const businesses = await Promise.all(candidates.map(async (candidate) => {
      const business = await persistence.getBusiness(
        candidate.externalId ? candidate.externalId : '',
      );
      return {
        ...candidate,
        business: business ?? null,
        problems: problems.filter((item) => item.businessId === business?.id),
        opportunities: opportunities.filter((item) => item.businessId === business?.id),
        outreach: outreach.filter((item) => item.businessId === business?.id),
        evidence: evidence.filter((item) => {
          const problemRefs = problems.filter((p) => p.businessId === business?.id).flatMap((p) => p.evidenceRefs);
          const opportunityRefs = opportunities.filter((o) => o.businessId === business?.id).flatMap((o) => o.evidenceRefs);
          return [...problemRefs, ...opportunityRefs].includes(item.id);
        }),
      };
    }));

    return NextResponse.json({
      runId,
      nicheId: nicheId ?? null,
      candidates,
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
