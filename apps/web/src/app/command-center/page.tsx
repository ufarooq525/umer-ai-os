import { colors, fonts } from '@umer/ui';
import {
  getAgentRuns,
  getAgents,
  getArtifacts,
  getOpportunities,
  getRecentAudit,
  getTasks,
  getWorkProjects,
} from '@/lib/control-api';
import {
  deriveActivityFeed,
  deriveAttentionCases,
  deriveCompanyPulse,
  deriveCompanyStory,
  deriveLiveActivity,
} from '@/lib/company-derive';
import { MetricTile } from '@/components/os/MetricTile';
import { LiveCompanyMap } from '@/components/os/LiveCompanyMap';
import { LiveActivityStream } from '@/components/os/LiveActivityStream';
import { CeoAttentionSummary } from '@/components/os/CeoAttentionSummary';
import { ActivityFeed } from '@/components/os/ActivityFeed';
import { AgentCard } from '@/components/os/AgentCard';
import { WhileYouWereAway } from '@/components/os/WhileYouWereAway';
import { agentCurrentRun, agentCurrentTask, agentProjectName } from '@/components/os/joins';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function CommandCenterPage() {
  const [opportunities, projects, tasks, agents, agentRuns, auditRecords, artifacts] = await Promise.all([
    getOpportunities(),
    getWorkProjects(),
    getTasks(),
    getAgents(),
    getAgentRuns(),
    getRecentAudit(),
    getArtifacts(),
  ]);

  const pulse = deriveCompanyPulse(agents, projects, tasks, opportunities);
  const attentionCases = deriveAttentionCases(agents, agentRuns, projects, tasks, opportunities);
  const story = deriveCompanyStory(pulse, attentionCases, projects, tasks, agents);
  const activity = deriveActivityFeed(auditRecords, opportunities, projects, tasks, agents);
  const liveActivity = deriveLiveActivity(agentRuns, agents);
  const isOperating = pulse.agents.working > 0 || pulse.projects.active > 0;

  const workingAgents = agents
    .filter((a) => a.status === 'active' && a.controlState === 'active')
    .slice(0, 6);

  return (
    <div style={{ display: 'grid', gap: 28 }}>
      <header>
        <p style={{ letterSpacing: '0.14em', textTransform: 'uppercase', color: colors.muted, fontSize: 11, fontWeight: 600, margin: 0 }}>
          Umer AI OS
        </p>
        <h1 style={{ fontSize: 'clamp(1.75rem, 3vw, 2.4rem)', fontWeight: 650, margin: '8px 0 0', letterSpacing: '-0.03em' }}>
          Company Operating
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0 0' }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: isOperating ? colors.success : colors.muted,
              display: 'inline-block',
            }}
          />
          <span style={{ fontFamily: fonts.mono, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: colors.muted }}>
            {isOperating ? 'COMPANY OPERATING' : 'COMPANY IDLE'}
          </span>
        </div>
        <p style={{ margin: '14px 0 0', color: colors.text, fontSize: 15, maxWidth: 760, lineHeight: 1.6 }}>{story}</p>
      </header>

      <section>
        <SectionTitle>Company Pulse</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          <MetricTile label="Opportunities" value={pulse.opportunities.total} href="/company/opportunities" sublines={[`${pulse.opportunities.promising} promising`, `${pulse.opportunities.selected} selected`]} />
          <MetricTile label="Active Projects" value={pulse.projects.active} href="/company/projects" sublines={[`${pulse.projects.total} total`, `${pulse.projects.blocked} paused`]} />
          <MetricTile label="Active Agents" value={pulse.agents.working} href="/company/agents" sublines={[`${pulse.agents.idle} idle`, `${pulse.agents.paused} paused`]} />
          <MetricTile label="Active Tasks" value={pulse.tasks.active} href="/company/tasks" sublines={[`${pulse.tasks.total} total`]} />
          <MetricTile label="Blocked Work" value={pulse.tasks.blocked} href="/company/tasks" sublines={['Needs unblocking']} />
          <MetricTile label="Decisions Required" value={pulse.decisionsRequired} href="/decisions" sublines={['High-score opportunities']} />
        </div>
      </section>

      <LiveActivityStream entries={liveActivity} />

      <LiveCompanyMap opportunities={opportunities} projects={projects} tasks={tasks} agents={agents} agentRuns={agentRuns} artifacts={artifacts} />

      {workingAgents.length > 0 ? (
        <section>
          <SectionTitle href="/company/agents">Active Company Work</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
            {workingAgents.map((agent) => (
              <AgentCard
                key={agent.agentId}
                agent={agent}
                run={agentCurrentRun(agent, agentRuns)}
                currentTaskTitle={agentCurrentTask(agent, tasks)?.title}
                projectName={agentProjectName(agent, tasks, projects)}
              />
            ))}
          </div>
        </section>
      ) : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <CeoAttentionSummary cases={attentionCases} />
        </div>
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <WhileYouWereAway auditRecords={auditRecords} agentRuns={agentRuns} />
        </div>
      </div>

      <section>
        <SectionTitle href="/activity">Recent Activity</SectionTitle>
        <ActivityFeed entries={activity} limit={6} />
      </section>
    </div>
  );
}

function SectionTitle({ children, href }: { children: React.ReactNode; href?: string }) {
  const title = (
    <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.muted, margin: '0 0 12px' }}>
      {children}
    </h2>
  );
  if (!href) return title;
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      {title}
    </Link>
  );
}
