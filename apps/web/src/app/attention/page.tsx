import { colors } from '@umer/ui';
import { getAgentRuns, getAgents, getCommercialIntelligenceSummary, getOpportunities, getTasks, getWorkProjects } from '@/lib/control-api';
import { deriveAttentionCases } from '@/lib/company-derive';
import { deriveCommercialAttentionCases } from '@/lib/commercial-intelligence';
import { AttentionCenter } from '@/components/os/AttentionCenter';

export const dynamic = 'force-dynamic';

export default async function AttentionPage() {
  const [agents, agentRuns, projects, tasks, opportunities, commercialSummary] = await Promise.all([
    getAgents(),
    getAgentRuns(),
    getWorkProjects(),
    getTasks(),
    getOpportunities(),
    getCommercialIntelligenceSummary(),
  ]);

  const cases = [
    ...deriveAttentionCases(agents, agentRuns, projects, tasks, opportunities),
    ...deriveCommercialAttentionCases(commercialSummary),
  ];

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <header>
        <h1 style={{ fontSize: 'clamp(1.5rem, 2.6vw, 2rem)', fontWeight: 650, margin: 0, letterSpacing: '-0.03em' }}>
          CEO Attention {cases.length > 0 ? `(${cases.length})` : ''}
        </h1>
        <p style={{ margin: '8px 0 0', color: colors.muted, fontSize: 14 }}>
          Every case here is backed by a real signal — a repeated agent failure, a queue of opportunities awaiting
          your decision, work that has been running longer than expected, or a real commercial-intelligence gap.
          Click a case to investigate it fully.
        </p>
      </header>
      <AttentionCenter cases={cases} />
    </div>
  );
}
