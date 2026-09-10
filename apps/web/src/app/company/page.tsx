import Link from 'next/link';
import { ArrowRight, Bot, LayoutGrid, CheckSquare } from 'lucide-react';
import { colors, fonts, radii } from '@umer/ui';
import { getAgentRuns, getAgents, getArtifacts, getOpportunities, getTasks, getWorkProjects } from '@/lib/control-api';
import { deriveAttentionCases, deriveCompanyPulse } from '@/lib/company-derive';
import { CompanySubNav } from '@/components/os/CompanySubNav';
import { LiveCompanyMap } from '@/components/os/LiveCompanyMap';
import { EntityNarrative, type NarrativeField } from '@/components/os/EntityNarrative';

export const dynamic = 'force-dynamic';

export default async function CompanyPage() {
  const [opportunities, projects, tasks, agents, agentRuns, artifacts] = await Promise.all([
    getOpportunities(),
    getWorkProjects(),
    getTasks(),
    getAgents(),
    getAgentRuns(),
    getArtifacts(),
  ]);


  const pulse = deriveCompanyPulse(agents, projects, tasks, opportunities);
  const attentionCases = deriveAttentionCases(agents, agentRuns, projects, tasks, opportunities);
  const critical = attentionCases.filter((a) => a.severity === 'critical');

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
          : 'No decisions pending. Operations running smoothly.',
    },
    {
      key: 'RESULT',
      value: `${pulse.opportunities.selected} opportunit${pulse.opportunities.selected === 1 ? 'y' : 'ies'} converted into active engineering work so far.`,
    },
    {
      key: 'PROBLEM',
      value:
        critical.length > 0
          ? `${critical.length} agent${critical.length === 1 ? '' : 's'} failing repeatedly — review Attention Center.`
          : 'None detected across active runs.',
    },
  ];

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <header>
        <h1 style={{ fontSize: 'clamp(1.5rem, 2.6vw, 2.1rem)', fontWeight: 650, margin: 0, letterSpacing: '-0.035em', color: '#ffffff' }}>
          Company Overview
        </h1>
        <p style={{ margin: '8px 0 0', color: colors.muted, fontSize: 14, maxWidth: 720 }}>
          Operating posture across all projects, agents, tasks, and commercial opportunities from the live authoritative record.
        </p>
      </header>

      <CompanySubNav />

      {/* Narrative Strip */}
      <EntityNarrative fields={fields} />

      {/* Executive Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
        <Link
          href="/company/agents"
          style={{
            padding: '16px 18px',
            borderRadius: radii.md,
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%), #12151e',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            textDecoration: 'none',
            color: colors.text,
            display: 'grid',
            gap: 4,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: colors.muted }}>
              AI Workforce
            </span>
            <Bot size={15} style={{ color: '#a78bfa' }} />
          </div>
          <div style={{ fontFamily: fonts.mono, fontSize: 24, fontWeight: 700, color: '#ffffff' }}>
            {pulse.agents.working} Working / {pulse.agents.total} Total
          </div>
          <div style={{ fontSize: 11.5, color: colors.muted }}>
            {pulse.agents.idle} idle · {pulse.agents.paused} paused by CEO
          </div>
        </Link>

        <Link
          href="/company/projects"
          style={{
            padding: '16px 18px',
            borderRadius: radii.md,
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%), #12151e',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            textDecoration: 'none',
            color: colors.text,
            display: 'grid',
            gap: 4,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: colors.muted }}>
              Active Projects
            </span>
            <LayoutGrid size={15} style={{ color: colors.success }} />
          </div>
          <div style={{ fontFamily: fonts.mono, fontSize: 24, fontWeight: 700, color: '#ffffff' }}>
            {pulse.projects.active} Active / {pulse.projects.total} Total
          </div>
          <div style={{ fontSize: 11.5, color: colors.muted }}>
            {pulse.projects.blocked} blocked or paused projects
          </div>
        </Link>

        <Link
          href="/company/tasks"
          style={{
            padding: '16px 18px',
            borderRadius: radii.md,
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%), #12151e',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            textDecoration: 'none',
            color: colors.text,
            display: 'grid',
            gap: 4,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: colors.muted }}>
              Canonical Tasks
            </span>
            <CheckSquare size={15} style={{ color: colors.info }} />
          </div>
          <div style={{ fontFamily: fonts.mono, fontSize: 24, fontWeight: 700, color: '#ffffff' }}>
            {pulse.tasks.active} In Flight / {pulse.tasks.total} Total
          </div>
          <div style={{ fontSize: 11.5, color: colors.muted }}>
            {pulse.tasks.blocked} blocked tasks requiring resolution
          </div>
        </Link>

        <Link
          href="/company/graph"
          style={{
            padding: '16px 18px',
            borderRadius: radii.md,
            background: 'linear-gradient(180deg, rgba(232, 160, 84, 0.08) 0%, rgba(255, 255, 255, 0.01) 100%), #12151e',
            border: '1px solid rgba(232, 160, 84, 0.3)',
            textDecoration: 'none',
            color: colors.text,
            display: 'grid',
            gap: 4,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: colors.accent }}>
              Company Brain Graph
            </span>
            <span style={{ color: colors.accent }}>⬡</span>
          </div>
          <div style={{ fontFamily: fonts.mono, fontSize: 24, fontWeight: 700, color: colors.accent }}>
            Interactive
          </div>
          <div style={{ fontSize: 11.5, color: colors.muted, display: 'flex', alignItems: 'center', gap: 4 }}>
            Explore graph relationships <ArrowRight size={12} />
          </div>
        </Link>
      </div>

      {/* Live Company Map */}
      <section style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 16, fontWeight: 650, margin: 0, color: colors.text }}>
            Live System Map
          </h2>
          <span style={{ fontSize: 12, color: colors.muted }}>
            Real-time visual relationships
          </span>
        </div>
        <LiveCompanyMap
          opportunities={opportunities}
          projects={projects}
          tasks={tasks}
          agents={agents}
          agentRuns={agentRuns}
          artifacts={artifacts}
        />
      </section>
    </div>
  );
}
