import { colors } from '@umer/ui';
import { getAgentRuns, getAgents, getOpportunities, getTasks, getWorkProjects } from '@/lib/control-api';
import { deriveAttention, deriveCompanyPulse } from '@/lib/company-derive';
import { LiveCompanyMap } from '@/components/os/LiveCompanyMap';
import { EntityNarrative, type NarrativeField } from '@/components/os/EntityNarrative';

export const dynamic = 'force-dynamic';

export default async function CompanyPage() {
  const [opportunities, projects, tasks, agents, agentRuns] = await Promise.all([
    getOpportunities(),
    getWorkProjects(),
    getTasks(),
    getAgents(),
    getAgentRuns(),
  ]);

  const pulse = deriveCompanyPulse(agents, projects, tasks, opportunities);
  const attention = deriveAttention(agents, agentRuns, projects, tasks, opportunities);
  const critical = attention.filter((a) => a.severity === 'critical');

  const fields: NarrativeField[] = [
    {
      key: 'NOW',
      value: `${pulse.projects.active} active project${pulse.projects.active === 1 ? '' : 's'}, ${pulse.agents.working} agent${pulse.agents.working === 1 ? '' : 's'} working.`,
    },
    {
      key: 'NEXT',
      value:
        pulse.decisionsRequired > 0
          ? `${pulse.decisionsRequired} opportunity decision${pulse.decisionsRequired === 1 ? '' : 's'} awaiting CEO review.`
          : 'No decisions pending.',
    },
    {
      key: 'RESULT',
      value: `${pulse.opportunities.selected} opportunit${pulse.opportunities.selected === 1 ? 'y' : 'ies'} converted into active work so far.`,
    },
    {
      key: 'PROBLEM',
      value:
        critical.length > 0
          ? `${critical.length} agent${critical.length === 1 ? '' : 's'} failing repeatedly — see Attention.`
          : 'None',
    },
  ];

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <header>
        <h1 style={{ fontSize: 'clamp(1.5rem, 2.6vw, 2rem)', fontWeight: 650, margin: 0, letterSpacing: '-0.03em' }}>Company</h1>
        <p style={{ margin: '8px 0 0', color: colors.muted, fontSize: 14, maxWidth: 640 }}>
          Every opportunity, project, agent and task the company is running right now, in one map.
        </p>
      </header>
      <EntityNarrative fields={fields} />
      <LiveCompanyMap opportunities={opportunities} projects={projects} tasks={tasks} agents={agents} agentRuns={agentRuns} />
    </div>
  );
}
