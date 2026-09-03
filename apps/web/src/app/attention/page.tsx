import { Card, colors } from '@umer/ui';
import { getAgentRuns, getAgents, getOpportunities, getTasks, getWorkProjects } from '@/lib/control-api';
import { deriveAttention } from '@/lib/company-derive';
import { AttentionCard } from '@/components/os/AttentionCard';

export const dynamic = 'force-dynamic';

export default async function AttentionPage() {
  const [agents, agentRuns, projects, tasks, opportunities] = await Promise.all([
    getAgents(),
    getAgentRuns(),
    getWorkProjects(),
    getTasks(),
    getOpportunities(),
  ]);

  const items = deriveAttention(agents, agentRuns, projects, tasks, opportunities);

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <header>
        <h1 style={{ fontSize: 'clamp(1.5rem, 2.6vw, 2rem)', fontWeight: 650, margin: 0, letterSpacing: '-0.03em' }}>
          Attention {items.length > 0 ? `(${items.length})` : ''}
        </h1>
        <p style={{ margin: '8px 0 0', color: colors.muted, fontSize: 14 }}>
          Everything that needs a CEO decision or is stuck — surfaced from real agent, task and opportunity state.
        </p>
      </header>

      {items.length === 0 ? (
        <Card>
          <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>Nothing needs your attention right now.</p>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
          {items.map((item) => (
            <AttentionCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
