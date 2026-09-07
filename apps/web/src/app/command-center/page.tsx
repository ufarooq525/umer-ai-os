import { Card, colors, fonts } from '@umer/ui';
import {
  getAgentRuns, getAgents, getArtifacts, getCommercialIntelligenceSummary, getDashboard, getOpportunities,
  getPendingGates, getProjects, getRecentAudit, getTasks, getWorkPackages, getWorkProjects,
  type OpportunityRecord, type WorkProjectRecord, type WorkTaskRecord,
} from '@/lib/control-api';
import { deriveActivityFeed, deriveAttentionCases, deriveCompanyPulse, deriveCompanyStory, deriveLiveActivity } from '@/lib/company-derive';
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
import { MarketScanBoard } from '@/components/os/MarketScanBoard';
import { DashboardSection, dashGrid } from '@/components/os/DashboardSection';
import { PagedChildren } from '@/components/os/PagedChildren';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
async function settled<T>(task: Promise<T>, fallback: T): Promise<T> { try { return await task; } catch { return fallback; } }

export default async function CommandCenterPage() {
  const [opportunities, projects, tasks, agents, agentRuns, auditRecords, artifacts, commercialSummary, dashboard, gates, catalog, workPackages, runtime] = await Promise.all([
    settled(getOpportunities(), []), settled(getWorkProjects(), []), settled(getTasks(), []), settled(getAgents(), []), settled(getAgentRuns(), []), settled(getRecentAudit(), []), settled(getArtifacts(), []),
    settled(getCommercialIntelligenceSummary(), { niches: [], outreachDraftsAwaitingReview: 0, businessesConsidered: 0, cap: 0 }), settled(getDashboard(), null), settled(getPendingGates(), []),
    settled(getProjects(), { projectsRoot: '', projects: [] }), settled(getWorkPackages(), []), probeRuntimeTruth(),
  ]);
  const pulse = deriveCompanyPulse(agents, projects, tasks, opportunities);
  const attentionCases = [...deriveAttentionCases(agents, agentRuns, projects, tasks, opportunities), ...deriveCommercialAttentionCases(commercialSummary)];
  const story = deriveCompanyStory(pulse, attentionCases, projects, tasks, agents);
  const activity = deriveActivityFeed(auditRecords, opportunities, projects, tasks, agents);
  const liveActivity = deriveLiveActivity(agentRuns, agents);
  const seoBoard = deriveSeoOwnerBoard({ projects: catalog.projects, gates });
  const brief = deriveMorningBrief({ pulse, attentionCases, opportunities, gates, dashboard, agentRuns, auditRecords, controlApiUp: runtime.controlApi.status === 'up', llm: { status: runtime.llm.status, label: runtime.llm.label } });
  const watchdogFindings = dashboard?.watchdogFindings ?? [];
  const workingAgents = agents.filter((a) => a.status === 'active' && a.controlState === 'active');
  const activeProjects = projects.filter((p) => p.status === 'Active');

  return (
    <div style={{ display: 'grid', gap: 28 }}>
      <header style={{ position: 'relative', overflow: 'hidden', display: 'grid', gap: 12, padding: '30px clamp(18px, 3vw, 34px)', borderRadius: 24, border: '1px solid rgba(255,255,255,.08)', background: 'radial-gradient(500px 220px at 100% 0%, rgba(118,91,255,.13), transparent 70%), radial-gradient(420px 240px at 0% 100%, rgba(62,211,169,.07), transparent 70%), rgba(255,255,255,.025)', boxShadow: '0 24px 80px rgba(0,0,0,.18)' }}>
        <div style={{ position: 'absolute', width: 180, height: 180, right: -80, top: -90, borderRadius: '50%', border: '1px solid rgba(255,255,255,.06)' }} />
        <p style={{ letterSpacing: '.16em', textTransform: 'uppercase', color: colors.muted, fontSize: 10, fontWeight: 700, margin: 0 }}>Umer AI OS · Company overview</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.65rem)', fontWeight: 650, margin: 0, letterSpacing: '-.045em' }}>Good morning, CEO.</h1>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 999, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.035)' }}>
            <PulseDot tone={brief.companyState === 'broken' ? 'danger' : brief.companyState === 'needs_you' ? 'wait' : brief.companyState === 'operating' ? 'live' : 'idle'} />
            <span style={{ fontFamily: fonts.mono, fontSize: 9, fontWeight: 700, letterSpacing: '.09em', color: colors.muted }}>{brief.companyState === 'broken' ? 'BROKEN' : brief.companyState === 'needs_you' ? 'NEEDS YOU' : brief.companyState === 'operating' ? 'OPERATING' : 'IDLE'}</span>
          </span>
        </div>
        <p style={{ margin: 0, color: colors.text, fontSize: 'clamp(13px, 1.5vw, 15px)', lineHeight: 1.7, maxWidth: 850 }}>{story}</p>
        <p style={{ margin: 0, color: colors.muted, fontSize: 11.5, lineHeight: 1.5 }}>A calm view of the company: decisions, people, opportunities and proof — only from the live record.</p>
      </header>

      <WatchdogFindingsBanner findings={watchdogFindings} />
      <RuntimeTruthStrip truth={runtime} />
      <DashboardSection title="Today" hint="The few things worth your attention first."><MorningBrief brief={brief} /></DashboardSection>
      <DashboardSection title="Pulse" hint="Live company numbers, not estimates."><div style={dashGrid.metrics}><MetricTile label="Opportunities" value={pulse.opportunities.total} href="/company/opportunities" sublines={[`${pulse.opportunities.promising} promising`, `${pulse.opportunities.selected} selected`]} /><MetricTile label="Active Projects" value={pulse.projects.active} href="/company/projects" sublines={[`${pulse.projects.total} total`, `${pulse.projects.blocked} paused`]} /><MetricTile label="Active Agents" value={pulse.agents.working} href="/company/agents" sublines={[`${pulse.agents.idle} idle`, `${pulse.agents.paused} paused`]} /><MetricTile label="Active Tasks" value={pulse.tasks.active} href="/company/tasks" sublines={[`${pulse.tasks.total} total`]} /><MetricTile label="Blocked Work" value={pulse.tasks.blocked} href="/company/tasks" sublines={['Needs unblocking']} /><MetricTile label="Decisions Required" value={pulse.decisionsRequired} href="/decisions" sublines={['High-score opportunities']} /><MetricTile label="Pending gates" value={dashboard?.pendingGates ?? gates.length} href="/gates" sublines={[`${dashboard?.workPackagesAwaitingReview ?? workPackages.filter((w) => w.status === 'AwaitingReview').length} awaiting review`]} /><MetricTile label="SEO approvals" value={brief.seoApprovals} href="/seo" sublines={['Owner board']} /></div></DashboardSection>
      <DashboardSection title="Hunt" href="/markets" hint="Rank cities first. Then approve one market and hunt operators."><MarketScanBoard variant="compact" /></DashboardSection>
      <DashboardSection title="Pipeline" href="/company/opportunities"><OpportunityPipelineStrip opportunities={opportunities} /></DashboardSection>
      <div style={dashGrid.twoCol}><DashboardSection title="Needs you" href="/attention"><CeoAttentionSummary cases={attentionCases} /></DashboardSection><DashboardSection title="While away"><WhileYouWereAway auditRecords={auditRecords} agentRuns={agentRuns} /></DashboardSection><DashboardSection title="Live work" href="/activity"><LiveActivityStream entries={liveActivity} pageSize={6} /></DashboardSection><DashboardSection title="Recent activity" href="/activity"><Card><ActivityFeed entries={activity} pageSize={6} /></Card></DashboardSection></div>
      <DashboardSection title="SEO you own" href="/seo"><SeoOwnerBoard board={seoBoard} compact /></DashboardSection>
      {workingAgents.length > 0 ? <DashboardSection title="Active agents" href="/company/agents"><PagedChildren pageSize={6} minItemWidth={260}>{workingAgents.map((agent) => <AgentCard key={agent.agentId} agent={agent} run={agentCurrentRun(agent, agentRuns)} currentTaskTitle={agentCurrentTask(agent, tasks)?.title} projectName={agentProjectName(agent, tasks, projects)} />)}</PagedChildren></DashboardSection> : null}
      {activeProjects.length > 0 ? <DashboardSection title="Active projects" href="/company/projects"><PagedChildren pageSize={6} minItemWidth={260}>{activeProjects.map((project) => <ActiveProjectCard key={project.projectId} project={project} tasks={tasks} />)}</PagedChildren></DashboardSection> : null}
      <LiveCompanyMap opportunities={opportunities} projects={projects} tasks={tasks} agents={agents} agentRuns={agentRuns} artifacts={artifacts} />
      <DashboardSection title="How the company operates"><CompanyOperatingFlow pulse={pulse} /></DashboardSection>
      <OpportunityControlCenter /><WorkerSupervisor />
      <details><summary style={{ cursor: 'pointer', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: colors.muted }}>Search, controls, and revenue lineage</summary><div style={{ display: 'grid', gap: 16, marginTop: 16 }}><GlobalAISearch compact /><CEOControlCenter /><MCPControlCenter /><RevenueLineage /></div></details>
    </div>
  );
}

function OpportunityPipelineStrip({ opportunities }: { opportunities: OpportunityRecord[] }) {
  const counts = OPPORTUNITY_STAGES.map((_, idx) => opportunities.filter((o) => opportunityStageIndex(o.status) === idx).length);
  return <Card><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(88px, 1fr))', gap: 8 }}>{OPPORTUNITY_STAGES.map((stage, idx) => <div key={stage} style={{ textAlign: 'center', padding: '8px 4px' }}><div style={{ fontSize: 22, fontWeight: 700, fontFamily: fonts.mono, color: counts[idx] > 0 ? colors.accent : colors.muted }}>{counts[idx]}</div><div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: colors.muted, marginTop: 4 }}>{stage}</div></div>)}</div></Card>;
}

function ActiveProjectCard({ project, tasks }: { project: WorkProjectRecord; tasks: WorkTaskRecord[] }) {
  const projectTasks = tasks.filter((t) => t.projectId === project.projectId); const done = projectTasks.filter((t) => t.status === 'Done').length; const agentIds = new Set(projectTasks.map((t) => t.assignedAgentId).filter(Boolean));
  return <Link href={`/company/projects/${project.projectId}`} style={{ display: 'block', padding: 16, borderRadius: 16, border: '1px solid rgba(255,255,255,.075)', background: 'linear-gradient(145deg, rgba(255,255,255,.045), rgba(255,255,255,.018))', textDecoration: 'none', color: colors.text, minHeight: 96, boxSizing: 'border-box' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}><strong style={{ fontSize: 14 }}>{project.name}</strong><StatusBadge tone={projectTone(project.status)} label={project.status} /></div><div style={{ fontSize: 12, color: colors.muted, marginTop: 8 }}>{projectTasks.length > 0 ? `${done}/${projectTasks.length} tasks done` : 'No tasks yet'} · {agentIds.size} agent{agentIds.size === 1 ? '' : 's'}</div></Link>;
}
