import { NextResponse } from 'next/server';
import { getAgentRuns, getAgents, getCommercialIntelligenceSummary, getOpportunities, getTasks, getWorkProjects } from '@/lib/control-api';
import { deriveAttentionCases } from '@/lib/company-derive';
import { deriveCommercialAttentionCases } from '@/lib/commercial-intelligence';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [agents, agentRuns, projects, tasks, opportunities, commercialSummary] = await Promise.all([
      getAgents(),
      getAgentRuns(),
      getWorkProjects(),
      getTasks(),
      getOpportunities(),
      getCommercialIntelligenceSummary(),
    ]);
    const count =
      deriveAttentionCases(agents, agentRuns, projects, tasks, opportunities).length +
      deriveCommercialAttentionCases(commercialSummary).length;
    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
