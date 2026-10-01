import Link from 'next/link';
import { Briefcase, AlertTriangle, Sparkles, DollarSign, ArrowRight, Scale, TrendingUp, CheckCircle2 } from 'lucide-react';
import { colors, fonts, radii } from '@umer/ui';
import {
  getAgentRuns,
  getAgents,
  getCommercialIntelligenceSummary,
  getDashboard,
  getOpportunities,
  getPendingGates,
  getRecentAudit,
  getTasks,
  getWorkPackages,
  getWorkProjects,
  getCompanyOverview,
  getWatchdogFindings,
} from '@/lib/control-api';
import { deriveAttentionCases, deriveCompanyPulse } from '@/lib/company-derive';
import { deriveCommercialAttentionCases } from '@/lib/commercial-intelligence';
import { deriveMorningBrief } from '@/lib/morning-brief';
import { probeRuntimeTruth } from '@/lib/runtime-truth';
import { PulseDot } from '@/components/os/PulseDot';
import { agentCurrentRun } from '@/components/os/joins';
import { CompanyNowHero } from '@/components/os/CompanyNowHero';
import { ExecutiveThreeCol } from '@/components/os/ExecutiveThreeCol';
import { HorizontalCompanyFlow } from '@/components/os/HorizontalCompanyFlow';
import { RuntimeTruthStrip } from '@/components/os/RuntimeTruthStrip';
import { formatRelativeTime } from '@/components/os/format';

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
    commercialSummary,
    dashboard,
    gates,
    workPackages,
    runtime,
    companyOverview,
    watchdogFindings,
  ] = await Promise.all([
    settled(getOpportunities(), []),
    settled(getWorkProjects(), []),
    settled(getTasks(), []),
    settled(getAgents(), []),
    settled(getAgentRuns(), []),
    settled(getRecentAudit(), []),
    settled(getCommercialIntelligenceSummary(), { niches: [], outreachDraftsAwaitingReview: 0, businessesConsidered: 0, cap: 0 }),
    settled(getDashboard(), null),
    settled(getPendingGates(), []),
    settled(getWorkPackages(), []),
    probeRuntimeTruth(),
    settled(getCompanyOverview(), null),
    settled(getWatchdogFindings({ status: 'open' }), []),
  ]);

  const pulse = deriveCompanyPulse(agents, projects, tasks, opportunities);
  const attentionCases = [
    ...deriveAttentionCases(agents, agentRuns, projects, tasks, opportunities),
    ...deriveCommercialAttentionCases(commercialSummary),
  ];
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
  // An agent whose current run keeps failing (e.g. no mandate registered)
  // isn't meaningfully "working" — exclude it so this count can't read as
  // healthier than it is next to the CEO Attention list flagging the same runs.
  // Also exclude stale agents (no recent activity in the last 10 minutes).
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  const workingAgents = agents.filter((a) => {
    if (a.status !== 'active' || a.controlState !== 'active') return false;
    const run = agentCurrentRun(a, agentRuns);
    if (run && run.failures.length > 0) return false;
    // Exclude stale agents (lastSeenAt older than 10 minutes)
    if (a.lastSeenAt && new Date(a.lastSeenAt) < tenMinutesAgo) return false;
    return true;
  });
  const activeProjects = projects.filter((p) => p.status === 'Active');

  // Revenue figures strictly from real authoritative state
  const recognizedRevenue = companyOverview?.revenueAndOutcomes?.recognizedRevenue ?? 0;
  const pipelineValue = companyOverview?.revenueAndOutcomes?.pipelineValue ?? 0;
  const totalWonRevenue = companyOverview?.revenueAndOutcomes?.totalWonRevenue ?? 0;

  return (
    <div style={{ display: 'grid', gap: 28 }}>
      {/* 1. TOP: EXECUTIVE GREETING & 4 COMPACT METRICS */}
      <section style={{ display: 'grid', gap: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontFamily: fonts.mono, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: colors.muted }}>
                UMER AI OS · EXECUTIVE CONTROL PLANE
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 8px', borderRadius: 999, background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <PulseDot tone={brief.companyState === 'broken' ? 'danger' : brief.companyState === 'needs_you' ? 'wait' : 'live'} />
                <span style={{ fontFamily: fonts.mono, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', color: colors.muted }}>
                  {brief.companyState === 'broken' ? 'INCIDENT' : brief.companyState === 'needs_you' ? 'NEEDS CEO' : 'OPERATING'}
                </span>
              </span>
            </div>
            <h1 style={{ fontSize: 'clamp(1.8rem, 3.4vw, 2.5rem)', fontWeight: 650, margin: 0, letterSpacing: '-0.04em', color: '#ffffff' }}>
              Good morning, CEO.
            </h1>
            <p style={{ margin: '6px 0 0', color: colors.muted, fontSize: 14 }}>
              Here&apos;s what is happening across the company.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link
              href="/company/graph"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '8px 16px',
                borderRadius: radii.sm,
                border: '1px solid rgba(232, 160, 84, 0.35)',
                background: 'rgba(232, 160, 84, 0.1)',
                color: colors.accent,
                fontSize: 12.5,
                fontWeight: 650,
                textDecoration: 'none',
              }}
            >
              <span>⬡</span> Company Intelligence Graph →
            </Link>
          </div>
        </div>

        {/* Four Compact Executive Metrics (From Real Data) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          {/* Active Work */}
          <Link
            href="/company/projects"
            style={{
              padding: '16px 20px',
              borderRadius: 14,
              background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.035) 0%, rgba(255, 255, 255, 0.015) 100%), #12151e',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              textDecoration: 'none',
              color: colors.text,
              display: 'grid',
              gap: 4,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: colors.muted }}>
                Active Work
              </span>
              <Briefcase size={15} style={{ color: colors.success }} />
            </div>
            <div style={{ fontFamily: fonts.mono, fontSize: 26, fontWeight: 700, color: '#ffffff', margin: '4px 0 2px' }}>
              {pulse.projects.active}
            </div>
            <div style={{ fontSize: 11.5, color: colors.muted }}>
              {workingAgents.length} agents working · {pulse.tasks.active} active tasks
            </div>
          </Link>

          {/* Attention */}
          <Link
            href={gates.length > 0 ? '/gates' : '/attention'}
            style={{
              padding: '16px 20px',
              borderRadius: 14,
              background: (attentionCases.length > 0 || gates.length > 0) ? 'linear-gradient(180deg, rgba(245, 158, 11, 0.07) 0%, rgba(255, 255, 255, 0.015) 100%), #12151e' : 'rgba(255, 255, 255, 0.02)',
              border: (attentionCases.length > 0 || gates.length > 0) ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(255, 255, 255, 0.07)',
              textDecoration: 'none',
              color: colors.text,
              display: 'grid',
              gap: 4,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: (attentionCases.length > 0 || gates.length > 0 || watchdogFindings.length > 0) ? colors.warning : colors.muted }}>
                Attention
              </span>
              <AlertTriangle size={15} style={{ color: (attentionCases.length > 0 || gates.length > 0 || watchdogFindings.length > 0) ? colors.warning : colors.muted }} />
            </div>
            <div style={{ fontFamily: fonts.mono, fontSize: 26, fontWeight: 700, color: (attentionCases.length > 0 || gates.length > 0 || watchdogFindings.length > 0) ? colors.warning : '#ffffff', margin: '4px 0 2px' }}>
              {attentionCases.length + gates.length + watchdogFindings.length}
            </div>
            <div style={{ fontSize: 11.5, color: colors.muted }}>
              {gates.length > 0 ? `${gates.length} gate${gates.length === 1 ? '' : 's'} · ` : ''}{watchdogFindings.length > 0 ? `${watchdogFindings.length} finding${watchdogFindings.length === 1 ? '' : 's'} · ` : ''}{pulse.decisionsRequired} decisions · {pulse.tasks.blocked} blocked
            </div>
          </Link>

          {/* Opportunities */}
          <Link
            href="/company/opportunities"
            style={{
              padding: '16px 20px',
              borderRadius: 14,
              background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.035) 0%, rgba(255, 255, 255, 0.015) 100%), #12151e',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              textDecoration: 'none',
              color: colors.text,
              display: 'grid',
              gap: 4,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: colors.muted }}>
                Opportunities
              </span>
              <Sparkles size={15} style={{ color: colors.accent }} />
            </div>
            <div style={{ fontFamily: fonts.mono, fontSize: 26, fontWeight: 700, color: '#ffffff', margin: '4px 0 2px' }}>
              {pulse.opportunities.total}
            </div>
            <div style={{ fontSize: 11.5, color: colors.muted }}>
              {pulse.opportunities.promising} promising · {pulse.opportunities.selected} selected
            </div>
          </Link>

          {/* Revenue */}
          <Link
            href="/finance"
            style={{
              padding: '16px 20px',
              borderRadius: 14,
              background: 'linear-gradient(180deg, rgba(93, 206, 160, 0.07) 0%, rgba(255, 255, 255, 0.015) 100%), #12151e',
              border: '1px solid rgba(93, 206, 160, 0.25)',
              textDecoration: 'none',
              color: colors.text,
              display: 'grid',
              gap: 4,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: colors.success }}>
                Recognized Revenue
              </span>
              <DollarSign size={15} style={{ color: colors.success }} />
            </div>
            <div style={{ fontFamily: fonts.mono, fontSize: 26, fontWeight: 700, color: colors.success, margin: '4px 0 2px' }}>
              ${recognizedRevenue.toLocaleString()}
            </div>
            <div style={{ fontSize: 11.5, color: colors.muted }}>
              Won ${totalWonRevenue.toLocaleString()} · Pipeline ${pipelineValue > 0 ? `$${pipelineValue.toLocaleString()}` : '$0'}
            </div>
          </Link>
        </div>
      </section>


      {/* 2. PRIMARY AREA: COMPANY NOW */}
      <section>
        <CompanyNowHero
          agents={agents}
          projects={projects}
          tasks={tasks}
          workPackages={workPackages}
          agentRuns={agentRuns}
          decisionsWaiting={pulse.decisionsRequired}
          overview={companyOverview}
        />
      </section>

      {/* 3. SECONDARY AREA: THREE-COLUMN LAYOUT (CEO ATTENTION | ACTIVE WORK | NEXT ACTIONS) */}
      <section>
        <ExecutiveThreeCol
          attentionCases={attentionCases}
          workPackages={workPackages}
          activeProjects={activeProjects}
          overview={companyOverview}
          decisionsRequiredCount={pulse.decisionsRequired}
        />
      </section>

      {/* 4. COMPANY FLOW: HORIZONTAL PIPELINE */}
      <section>
        <HorizontalCompanyFlow
          opportunities={opportunities}
          projects={projects}
          tasks={tasks}
          workPackages={workPackages}
          overview={companyOverview}
        />
      </section>

      {/* 5. BOTTOM: SUMMARIZED RECENT DECISIONS, ACTIVITY & OUTCOMES */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
        {/* Recent Decisions Summary */}
        <div
          style={{
            padding: '20px 22px',
            borderRadius: 16,
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%), #11141c',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Scale size={16} style={{ color: colors.accent }} />
              <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Recent Decisions
              </h3>
            </div>
            <Link href="/decisions" style={{ fontSize: 11.5, color: colors.accent, textDecoration: 'none', fontWeight: 600 }}>
              Decision Center →
            </Link>
          </div>

          <div style={{ display: 'grid', gap: 10, flex: 1 }}>
            {gates.length > 0 && (
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: radii.sm,
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: colors.warning }}>
                    {gates.length} Quality Gate{gates.length === 1 ? '' : 's'} Awaiting Sign-Off
                  </div>
                  <Link
                    href="/company/graph?q=gate"
                    style={{ fontSize: 11, color: colors.accent, textDecoration: 'none', fontWeight: 600 }}
                  >
                    View in Graph ⬡
                  </Link>
                </div>
                <div style={{ fontSize: 11.5, color: colors.muted, marginTop: 4 }}>
                  Specialist deliverables (engineering code diff, QA test plan, or security audit) require CEO review before release.
                </div>
                <Link
                  href="/gates"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    color: colors.warning,
                    fontSize: 12,
                    fontWeight: 700,
                    textDecoration: 'none',
                    marginTop: 8,
                  }}
                >
                  Review Quality Gates <ArrowRight size={12} />
                </Link>
              </div>
            )}

            {pulse.decisionsRequired > 0 && (
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: radii.sm,
                  background: 'rgba(232, 160, 84, 0.08)',
                  border: '1px solid rgba(232, 160, 84, 0.25)',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 650, color: colors.text }}>
                  {pulse.decisionsRequired} Opportunity Approvals Awaiting Review
                </div>
                <div style={{ fontSize: 11.5, color: colors.muted, marginTop: 4 }}>
                  High-score commercial prospects have passed specialist qualification and await CEO decision.
                </div>
                <Link
                  href="/decisions"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    color: colors.accent,
                    fontSize: 12,
                    fontWeight: 700,
                    textDecoration: 'none',
                    marginTop: 8,
                  }}
                >
                  Review Decisions <ArrowRight size={12} />
                </Link>
              </div>
            )}

            {watchdogFindings.length > 0 && (
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: radii.sm,
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 650, color: colors.text }}>
                    {watchdogFindings.length} Watchdog Finding{watchdogFindings.length === 1 ? '' : 's'} Detected
                  </div>
                  <Link
                    href="/watchdogs"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 11,
                      fontFamily: fonts.mono,
                      color: colors.danger,
                      textDecoration: 'none',
                    }}
                  >
                    Console →
                  </Link>
                </div>
                <div style={{ fontSize: 11.5, color: colors.muted, marginTop: 4 }}>
                  Observation-only background watchdogs detected security, dependency, QA, or architecture issues.
                </div>
                <Link
                  href="/watchdogs"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    color: colors.danger,
                    fontSize: 12,
                    fontWeight: 700,
                    textDecoration: 'none',
                    marginTop: 8,
                  }}
                >
                  Review Watchdog Findings <ArrowRight size={12} />
                </Link>
              </div>
            )}

            {gates.length === 0 && pulse.decisionsRequired === 0 && watchdogFindings.length === 0 && (
              <div style={{ padding: '24px 10px', textAlign: 'center', color: colors.muted, fontSize: 12.5 }}>
                <CheckCircle2 size={20} style={{ color: colors.success, margin: '0 auto 6px', opacity: 0.8 }} />
                No quality gates, decisions, or watchdog findings pending. Autonomous operations running within approved boundaries.
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity Narrative */}
        <div
          style={{
            padding: '20px 22px',
            borderRadius: 16,
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%), #11141c',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={16} style={{ color: colors.success }} />
              <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Executive Activity
              </h3>
            </div>
            <Link href="/activity" style={{ fontSize: 11.5, color: colors.accent, textDecoration: 'none', fontWeight: 600 }}>
              Full Stream →
            </Link>
          </div>

          <div style={{ display: 'grid', gap: 10, flex: 1 }}>
            {auditRecords.slice(0, 3).map((record) => (
              <div
                key={record.id || record.auditId}
                style={{
                  padding: '10px 12px',
                  borderRadius: radii.sm,
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  fontSize: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', color: colors.muted, fontSize: 10.5, fontFamily: fonts.mono }}>
                  <span style={{ color: colors.accent }}>{record.actor}</span>
                  <span>{formatRelativeTime(record.occurredAt)}</span>
                </div>
                <div style={{ fontWeight: 600, color: colors.text, marginTop: 4 }}>
                  {record.action.replace(/_/g, ' ')} · {record.resourceType}
                </div>
              </div>
            ))}
            {auditRecords.length === 0 && (
              <div style={{ padding: '24px 10px', textAlign: 'center', color: colors.muted, fontSize: 12.5 }}>
                Zero recent audit events logged.
              </div>
            )}
          </div>
        </div>

        {/* Commercial & Learning Outcomes */}
        <div
          style={{
            padding: '20px 22px',
            borderRadius: 16,
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%), #11141c',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Briefcase size={16} style={{ color: colors.info }} />
              <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Outcome &amp; Learning
              </h3>
            </div>
            <Link href="/finance" style={{ fontSize: 11.5, color: colors.accent, textDecoration: 'none', fontWeight: 600 }}>
              Revenue Lineage →
            </Link>
          </div>

          <div style={{ display: 'grid', gap: 10, flex: 1, fontSize: 12.5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <span style={{ color: colors.muted }}>Pricing Multiplier</span>
              <strong style={{ fontFamily: fonts.mono, color: colors.accent }}>
                {companyOverview?.revenueAndOutcomes?.recommendedPriceMultiplier ? `${companyOverview.revenueAndOutcomes.recommendedPriceMultiplier}x` : '1.0x'}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <span style={{ color: colors.muted }}>Target Margin</span>
              <strong style={{ fontFamily: fonts.mono, color: colors.success }}>
                {companyOverview?.revenueAndOutcomes?.averageMarginPercent ? `${companyOverview.revenueAndOutcomes.averageMarginPercent}%` : '85%'}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
              <span style={{ color: colors.muted }}>Active Autonomous Cycles</span>
              <strong style={{ fontFamily: fonts.mono }}>
                {companyOverview?.whatCompanyIsDoing?.activeLoopCyclesCount ?? 1} Cycles
              </strong>
            </div>
          </div>
        </div>
      </section>

      {/* 6. EXPANDABLE TECHNICAL CONTROLS & DIAGNOSTICS */}
      <details
        style={{
          borderRadius: 14,
          border: '1px solid rgba(255, 255, 255, 0.06)',
          background: 'rgba(255, 255, 255, 0.015)',
          padding: '12px 18px',
        }}
      >
        <summary
          style={{
            cursor: 'pointer',
            fontSize: 11.5,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: colors.muted,
          }}
        >
          Technical operations &amp; runtime diagnostics
        </summary>
        <div style={{ display: 'grid', gap: 16, marginTop: 16 }}>
          <RuntimeTruthStrip truth={runtime} />
        </div>
      </details>
    </div>
  );
}
