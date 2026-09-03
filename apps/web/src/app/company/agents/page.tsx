import { Card, colors } from '@umer/ui';
import { getAgentRuns, getAgents, getTasks, getWorkProjects } from '@/lib/control-api';
import { AgentCard } from '@/components/os/AgentCard';
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
          <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>No agents have registered yet.</p>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
          {agents.map((agent) => (
            <AgentCard
              key={agent.agentId}
              agent={agent}
              run={agentCurrentRun(agent, agentRuns)}
              currentTaskTitle={agentCurrentTask(agent, tasks)?.title}
              projectName={agentProjectName(agent, tasks, projects)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
