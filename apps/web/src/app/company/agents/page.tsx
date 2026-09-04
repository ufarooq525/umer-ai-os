import { Card, colors } from '@umer/ui';
import { getAgentRuns, getAgents, getTasks, getWorkProjects } from '@/lib/control-api';
import { AgentCard } from '@/components/os/AgentCard';
import { PagedChildren } from '@/components/os/PagedChildren';
import { agentCurrentRun, agentCurrentTask, agentProjectName } from '@/components/os/joins';

export const dynamic = 'force-dynamic';

export default async function AgentsPage() {
  const [agents, tasks, projects, agentRuns] = await Promise.all([
    getAgents(),
    getTasks(),
    getWorkProjects(),
    getAgentRuns(),
  ]);

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <header>
        <h1 style={{ fontSize: 'clamp(1.5rem, 2.6vw, 2rem)', fontWeight: 650, margin: 0, letterSpacing: '-0.03em' }}>
          Agents ({agents.length})
        </h1>
        <p style={{ margin: '8px 0 0', color: colors.muted, fontSize: 14 }}>The AI workforce, and what each one is doing right now.</p>
      </header>

      {agents.length === 0 ? (
        <Card>
          <p style={{ margin: '0 0 12px', color: colors.text, fontSize: 14, lineHeight: 1.6 }}>
            No active agents registered. The workforce becomes visible here as agents come online and begin
            executing company work.
          </p>
          <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.muted }}>
            Expected operational view
          </p>
          <div style={{ display: 'grid', gap: 4, opacity: 0.55 }}>
            {[
              ['Growth Agent', 'WORKING'],
              ['Research Agent', 'WORKING'],
              ['Product Agent', 'IDLE'],
              ['Engineering Agent', 'WAITING'],
            ].map(([name, status]) => (
              <div key={name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: colors.muted, fontStyle: 'italic', maxWidth: 280 }}>
                <span>{name}</span>
                <span>{status}</span>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <PagedChildren pageSize={12} minItemWidth={280}>
          {agents.map((agent) => (
            <AgentCard
              key={agent.agentId}
              agent={agent}
              run={agentCurrentRun(agent, agentRuns)}
              currentTaskTitle={agentCurrentTask(agent, tasks)?.title}
              projectName={agentProjectName(agent, tasks, projects)}
            />
          ))}
        </PagedChildren>
      )}
    </div>
  );
}
