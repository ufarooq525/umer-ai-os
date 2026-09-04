import { Card, colors, fonts } from '@umer/ui';
import {
  getAgentRuns,
  getAgents,
  getArtifacts,
  getCommercialIntelligenceSummary,
  getDashboard,
  getOpportunities,
  getPendingGates,
  getProjects,
  getRecentAudit,
  getTasks,
  getWorkPackages,
  getWorkProjects,
  type OpportunityRecord,
  type WorkProjectRecord,
  type WorkTaskRecord,
} from '@/lib/control-api';
import {
  deriveActivityFeed,
  deriveAttentionCases,
  deriveCompanyPulse,
  deriveCompanyStory,
  deriveLiveActivity,
} from '@/lib/company-derive';
import { deriveCommercialAttentionCases } from '@/lib/commercial-intelligence';
import { deriveMorningBrief } from '@/lib/morning-brief';
import { deriveSeoOwnerBoard } from '@/lib/seo-owner';
import { probeRuntimeTruth } from '@/lib/runtime-truth';
import { MetricTile } from '@/components/os/MetricTile';
import { CompanyOperatingFlow } from '@/components/os/CompanyOperatingFlow';
import { LiveCompanyMap } from '@/components/os/LiveCompanyMap';
import { LiveActivityStream } from '@/components/os/LiveActivityStream';
import { CeoAttentionSummary } from '@/components/os/CeoAttentionSummary';
import { ActivityFeed } from '@/components/os/ActivityFeed';
import { AgentCard } from '@/components/os/AgentCard';
import { WhileYouWereAway } from '@/components/os/WhileYouWereAway';
import { agentCurrentRun, agentCurrentTask, agentProjectName } from '@/components/os/joins';
import { OPPORTUNITY_STAGES, opportunityStageIndex } from '@/components/os/OpportunityJourney';
import { StatusBadge } from '@/components/os/StatusBadge';
import { projectTone } from '@/components/os/status';
import { MorningBrief } from '@/components/os/MorningBrief';
import { SeoOwnerBoard } from '@/components/os/SeoOwnerBoard';
import { RuntimeTruthStrip } from '@/components/os/RuntimeTruthStrip';
import { PulseDot } from '@/components/os/PulseDot';
import { GlobalAISearch } from '@/components/GlobalAISearch';
import { WorkerSupervisor } from '@/components/WorkerSupervisor';
import { OpportunityControlCenter } from '@/components/OpportunityControlCenter';
import { CEOControlCenter } from '@/components/CEOControlCenter';
import { MCPControlCenter } from '@/components/MCPControlCenter';
import { RevenueLineage } from '@/components/RevenueLineage';
import { WatchdogFindingsBanner } from '@/components/WatchdogFindingsBanner';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function settled<T>(task: Promise<T>, fallback: T): Promise<T> {
  try {
    return await task;
  } catch {
    return fallback;
  }
}

export default async function CommandCenterPage() {
  const [
    opportunities,
    projects,
    tasks,
    agents,
    agentRuns,
    auditRecords,
    artifacts,
    commercialSummary,
    dashboard,
    gates,
    catalog,
    workPackages,
    runtime,
  ] = await Promise.all([
    settled(getOpportunities(), []),
    settled(getWorkProjects(), []),
    settled(getTasks(), []),
    settled(getAgents(), []),
    settled(getAgentRuns(), []),
    settled(getRecentAudit(), []),
    settled(getArtifacts(), []),
    settled(getCommercialIntelligenceSummary(), {
      niches: [],
      outreachDraftsAwaitingReview: 0,
      businessesConsidered: 0,
      cap: 0,
    }),
    settled(getDashboard(), null),
    settled(getPendingGates(), []),
    settled(getProjects(), { projectsRoot: '', projects: [] }),
    settled(getWorkPackages(), []),
    probeRuntimeTruth(),
  ]);

  const pulse = deriveCompanyPulse(agents, projects, tasks, opportunities);
  const attentionCases = [
    ...deriveAttentionCases(agents, agentRuns, projects, tasks, opportunities),
    ...deriveCommercialAttentionCases(commercialSummary),
  ];
  const story = deriveCompanyStory(pulse, attentionCases, projects, tasks, agents);
  const activity = deriveActivityFeed(auditRecords, opportunities, projects, tasks, agents);
  const liveActivity = deriveLiveActivity(agentRuns, agents);
  const seoBoard = deriveSeoOwnerBoard({ projects: catalog.projects, gates });
  const brief = deriveMorningBrief({
    pulse,
    attentionCases,
    opportunities,
    gates,
    dashboard,
    agentRuns,
    auditRecords,
    controlApiUp: runtime.controlApi.status === 'up',
    llm: { status: runtime.llm.status, label: runtime.llm.label },
  });
  const watchdogFindings = dashboard?.watchdogFindings ?? [];

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
          Command Center
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
          <PulseDot
            tone={
              brief.companyState === 'broken' ? 'danger' : brief.companyState === 'needs_you' ? 'wait' : brief.companyState === 'operating' ? 'live' : 'idle'
            }
          />
          <span style={{ fontFamily: fonts.mono, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: colors.muted }}>
            {brief.companyState === 'broken'
              ? 'COMPANY BROKEN'
              : brief.companyState === 'needs_you'
                ? 'NEEDS YOU'
                : brief.companyState === 'operating'
                  ? 'COMPANY OPERATING'
                  : 'COMPANY IDLE'}
          </span>
        </div>
        <p style={{ margin: '14px 0 0', color: colors.text, fontSize: 15, maxWidth: 760, lineHeight: 1.6 }}>{story}</p>
      </header>

      <WatchdogFindingsBanner findings={watchdogFindings} />
      <RuntimeTruthStrip truth={runtime} />
      <GlobalAISearch compact />
      <MorningBrief brief={brief} />
      <SeoOwnerBoard board={seoBoard} compact />

      <CompanyOperatingFlow pulse={pulse} />

      <section>
        <SectionTitle>Company Pulse</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          <MetricTile label="Opportunities" value={pulse.opportunities.total} href="/company/opportunities" sublines={[`${pulse.opportunities.promising} promising`, `${pulse.opportunities.selected} selected`]} />
          <MetricTile label="Active Projects" value={pulse.projects.active} href="/company/projects" sublines={[`${pulse.projects.total} total`, `${pulse.projects.blocked} paused`]} />
          <MetricTile label="Active Agents" value={pulse.agents.working} href="/company/agents" sublines={[`${pulse.agents.idle} idle`, `${pulse.agents.paused} paused`]} />
          <MetricTile label="Active Tasks" value={pulse.tasks.active} href="/company/tasks" sublines={[`${pulse.tasks.total} total`]} />
          <MetricTile label="Blocked Work" value={pulse.tasks.blocked} href="/company/tasks" sublines={['Needs unblocking']} />
          <MetricTile label="Decisions Required" value={pulse.decisionsRequired} href="/decisions" sublines={['High-score opportunities']} />
          <MetricTile label="Pending gates" value={dashboard?.pendingGates ?? gates.length} href="/gates" sublines={[`${dashboard?.workPackagesAwaitingReview ?? workPackages.filter((w) => w.status === 'AwaitingReview').length} awaiting review`]} />
          <MetricTile label="SEO approvals" value={brief.seoApprovals} href="/seo" sublines={['Owner board']} />
        </div>
      </section>

      <section>
        <SectionTitle href="/company/opportunities">Opportunity Pipeline</SectionTitle>
        <OpportunityPipelineStrip opportunities={opportunities} />
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

      {projects.filter((p) => p.status === 'Active').length > 0 ? (
        <section>
          <SectionTitle href="/company/projects">Active Projects</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
            {projects
              .filter((p) => p.status === 'Active')
              .map((project) => (
                <ActiveProjectCard key={project.projectId} project={project} tasks={tasks} />
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

      <OpportunityControlCenter />
      <WorkerSupervisor />

      <details>
        <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: colors.muted }}>
          Controls, tools, and revenue lineage
        </summary>
        <div style={{ display: 'grid', gap: 16, marginTop: 16 }}>
          <CEOControlCenter />
          <MCPControlCenter />
          <RevenueLineage />
        </div>
      </details>
    </div>
  );
}

function OpportunityPipelineStrip({ opportunities }: { opportunities: OpportunityRecord[] }) {
  const counts = OPPORTUNITY_STAGES.map((_, idx) => opportunities.filter((o) => opportunityStageIndex(o.status) === idx).length);
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, overflowX: 'auto' }}>
        {OPPORTUNITY_STAGES.map((stage, idx) => (
          <div key={stage} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ textAlign: 'center', minWidth: 100, padding: '4px 8px' }}>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: fonts.mono, color: counts[idx] > 0 ? colors.accent : colors.muted }}>
                {counts[idx]}
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: colors.muted, marginTop: 2 }}>
                {stage}
              </div>
            </div>
            {idx < OPPORTUNITY_STAGES.length - 1 ? <span style={{ color: colors.border, fontSize: 16, alignSelf: 'center' }}>→</span> : null}
          </div>
        ))}
      </div>
    </Card>
  );
}

function ActiveProjectCard({ project, tasks }: { project: WorkProjectRecord; tasks: WorkTaskRecord[] }) {
  const projectTasks = tasks.filter((t) => t.projectId === project.projectId);
  const done = projectTasks.filter((t) => t.status === 'Done').length;
  const agentIds = new Set(projectTasks.map((t) => t.assignedAgentId).filter(Boolean));
  return (
    <Link
      href={`/company/projects/${project.projectId}`}
      style={{
        display: 'block',
        padding: 16,
        borderRadius: 14,
        border: `1px solid ${colors.border}`,
        background: colors.surface,
        textDecoration: 'none',
        color: colors.text,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <strong style={{ fontSize: 14 }}>{project.name}</strong>
        <StatusBadge tone={projectTone(project.status)} label={project.status} />
      </div>
      <div style={{ fontSize: 12, color: colors.muted, marginTop: 8 }}>
        {projectTasks.length > 0 ? `${done}/${projectTasks.length} tasks done` : 'No tasks yet'} · {agentIds.size} agent{agentIds.size === 1 ? '' : 's'}
      </div>
    </Link>
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
