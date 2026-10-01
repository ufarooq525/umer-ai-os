import Link from 'next/link';
import { Sparkles, AlertTriangle, Bot, ArrowRight, CheckCircle2, ExternalLink } from 'lucide-react';
import { colors, fonts, radii } from '@umer/ui';
import {
  getAgentRuns,
  getAgents,
  getOpportunities,
  getPendingGates,
} from '@/lib/control-api';
import { deriveAttentionCases, deriveCompanyPulse } from '@/lib/company-derive';
import { agentCurrentRun } from '@/components/os/joins';
import { formatRelativeTime } from '@/components/os/format';
import { FirstRunGuide } from '@/components/FirstRunGuide';

export const dynamic = 'force-dynamic';

async function settled<T>(task: Promise<T>, fallback: T): Promise<T> {
  try {
    return await task;
  } catch {
    return fallback;
  }
}

export default async function HomePage() {
  const [opportunities, agents, agentRuns, gates] = await Promise.all([
    settled(getOpportunities(), []),
    settled(getAgents(), []),
    settled(getAgentRuns(), []),
    settled(getPendingGates(), []),
  ]);

  const pulse = deriveCompanyPulse(agents, [], [], opportunities);
  const attentionCases = deriveAttentionCases(agents, agentRuns, [], [], opportunities);

  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  const workingAgents = agents.filter((a) => {
    if (a.status !== 'active' || a.controlState !== 'active') return false;
    const run = agentCurrentRun(a, agentRuns);
    if (run && run.failures.length > 0) return false;
    if (a.lastSeenAt && new Date(a.lastSeenAt) < tenMinutesAgo) return false;
    return true;
  });

  // Top 3-5 items needing decisions
  type DecisionItem = {
    title: string;
    severity: 'warning' | 'danger' | 'info';
    category: string;
    evidence: string[];
    actionHref: string;
  };
  
  const gateDecisions: DecisionItem[] = gates.map((g) => ({
    title: `Quality Review: ${g.stageFrom} → ${g.stageTo}`,
    severity: 'warning' as const,
    category: 'Quality Review',
    evidence: [`Awaiting approval for ${g.workPackageId}`],
    actionHref: '/gates',
  }));
  
  const attentionDecisions: DecisionItem[] = attentionCases.slice(0, 3).map((a) => ({
    title: a.title,
    severity: a.severity === 'critical' ? 'danger' : (a.severity as 'warning' | 'danger' | 'info'),
    category: a.category,
    evidence: a.evidence,
    actionHref: '/decisions',
  }));
  
  const topDecisions = [...gateDecisions, ...attentionDecisions].slice(0, 5);

  // New opportunities (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const newOpportunities = opportunities
    .filter((o) => new Date(o.createdAt) > sevenDaysAgo)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  // Next step suggestion
  const nextStep = topDecisions.length > 0
    ? { label: 'Review pending approvals', href: topDecisions[0]!.actionHref, icon: AlertTriangle, color: colors.warning }
    : newOpportunities.length > 0
    ? { label: 'Review new opportunities', href: '/company/opportunities', icon: Sparkles, color: colors.accent }
    : opportunities.length === 0
    ? { label: 'Start discovery for a niche', href: '/markets', icon: Sparkles, color: colors.accent }
    : { label: 'View all agents', href: '/company/agents', icon: Bot, color: colors.info };

  return (
    <div style={{ display: 'grid', gap: 28, maxWidth: 1400, margin: '0 auto', padding: '0 20px' }}>
      {/* Header */}
      <section style={{ paddingTop: 12 }}>
        <h1 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.3rem)', fontWeight: 650, margin: 0, letterSpacing: '-0.04em', color: '#ffffff' }}>
          Today
        </h1>
        <p style={{ margin: '6px 0 0', color: colors.muted, fontSize: 14 }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </section>

      {/* First-run guide (dismissible) */}
      <FirstRunGuide />

      {/* Main content grid */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 18 }}>
        {/* Needs Your Decision */}
        <div
          style={{
            padding: '20px 22px',
            borderRadius: 16,
            background: topDecisions.length > 0 
              ? 'linear-gradient(180deg, rgba(245, 158, 11, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%), #11141c'
              : 'linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%), #11141c',
            border: topDecisions.length > 0 
              ? '1px solid rgba(245, 158, 11, 0.3)'
              : '1px solid rgba(255, 255, 255, 0.07)',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 300,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: topDecisions.length > 0 ? colors.warning : colors.text }}>
              Needs Your Decision
            </h3>
            <span style={{ fontFamily: fonts.mono, fontSize: 18, fontWeight: 700, color: topDecisions.length > 0 ? colors.warning : colors.muted }}>
              {topDecisions.length}
            </span>
          </div>

          <div style={{ display: 'grid', gap: 10, flex: 1 }}>
            {topDecisions.length > 0 ? (
              topDecisions.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '14px 16px',
                    borderRadius: radii.sm,
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 650, color: colors.text }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: 11.5, color: colors.muted }}>
                    {item.category} · {item.evidence[0] || 'Review required'}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <Link
                      href={item.actionHref}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        background: colors.accent,
                        color: '#0e0a05',
                        fontSize: 11.5,
                        fontWeight: 700,
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      Review <ArrowRight size={12} />
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: colors.muted, fontSize: 13, textAlign: 'center', padding: '24px 12px' }}>
                <CheckCircle2 size={28} style={{ marginBottom: 10, opacity: 0.6 }} />
                <div>No decisions pending.</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>You're all caught up!</div>
              </div>
            )}
          </div>
        </div>

        {/* What's New */}
        <div
          style={{
            padding: '20px 22px',
            borderRadius: 16,
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%), #11141c',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 300,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              What's New
            </h3>
            <Link href="/company/opportunities" style={{ fontSize: 11.5, color: colors.accent, textDecoration: 'none', fontWeight: 600 }}>
              View All →
            </Link>
          </div>

          <div style={{ display: 'grid', gap: 10, flex: 1 }}>
            {newOpportunities.length > 0 ? (
              newOpportunities.map((opp) => (
                <Link
                  key={opp.id}
                  href={`/company/opportunities/${opp.id}`}
                  style={{
                    padding: '14px 16px',
                    borderRadius: radii.sm,
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    textDecoration: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 650, color: colors.text }}>
                    {opp.title}
                  </div>
                  <div style={{ fontSize: 11.5, color: colors.muted }}>
                    {opp.geography} · Score: {opp.score?.overall?.toFixed(0) ?? 'N/A'}
                  </div>
                  <div style={{ fontSize: 10.5, fontFamily: fonts.mono, color: colors.muted }}>
                    {formatRelativeTime(opp.createdAt)}
                  </div>
                </Link>
              ))
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: colors.muted, fontSize: 13, textAlign: 'center', padding: '24px 12px' }}>
                <Sparkles size={28} style={{ marginBottom: 10, opacity: 0.6 }} />
                <div>No new opportunities this week.</div>
                <Link href="/markets" style={{ fontSize: 12, marginTop: 8, color: colors.accent, textDecoration: 'none', fontWeight: 600 }}>
                  Start discovery →
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* What's Running */}
        <div
          style={{
            padding: '20px 22px',
            borderRadius: 16,
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%), #11141c',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 300,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              What's Running
            </h3>
            <Link href="/company/agents" style={{ fontSize: 11.5, color: colors.accent, textDecoration: 'none', fontWeight: 600 }}>
              View All →
            </Link>
          </div>

          <div style={{ display: 'grid', gap: 14, flex: 1 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ padding: '12px 14px', borderRadius: radii.sm, background: 'rgba(93, 206, 160, 0.08)', border: '1px solid rgba(93, 206, 160, 0.25)' }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: colors.success, marginBottom: 6 }}>
                  Active Agents
                </div>
                <div style={{ fontFamily: fonts.mono, fontSize: 24, fontWeight: 700, color: colors.success }}>
                  {workingAgents.length}
                </div>
              </div>
              <div style={{ padding: '12px 14px', borderRadius: radii.sm, background: 'rgba(232, 160, 84, 0.08)', border: '1px solid rgba(232, 160, 84, 0.25)' }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: colors.accent, marginBottom: 6 }}>
                  Opportunities
                </div>
                <div style={{ fontFamily: fonts.mono, fontSize: 24, fontWeight: 700, color: colors.accent }}>
                  {pulse.opportunities.total}
                </div>
              </div>
            </div>

            {workingAgents.length > 0 ? (
              <div style={{ display: 'grid', gap: 8 }}>
                {workingAgents.slice(0, 3).map((agent) => {
                  const run = agentCurrentRun(agent, agentRuns);
                  return (
                    <Link
                      key={agent.agentId}
                      href={`/company/agents/${agent.agentId}`}
                      style={{
                        padding: '10px 12px',
                        borderRadius: radii.sm,
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        textDecoration: 'none',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 600, color: colors.text }}>
                        {agent.name || agent.specialistId}
                      </div>
                      <div style={{ fontSize: 10.5, fontFamily: fonts.mono, color: colors.success }}>
                        {run?.status || 'active'}
                      </div>
                    </Link>
                  );
                })}
                {workingAgents.length > 3 && (
                  <Link
                    href="/company/agents"
                    style={{
                      padding: '8px 12px',
                      borderRadius: radii.sm,
                      background: 'transparent',
                      border: '1px dashed rgba(255, 255, 255, 0.15)',
                      textDecoration: 'none',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: colors.accent,
                    }}
                  >
                    +{workingAgents.length - 3} more agents →
                  </Link>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: colors.muted, fontSize: 13, textAlign: 'center', padding: '12px' }}>
                <Bot size={28} style={{ marginBottom: 10, opacity: 0.6 }} />
                <div>No agents currently active.</div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Next Step */}
      <section>
        <Link
          href={nextStep.href}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px',
            borderRadius: 14,
            background: 'linear-gradient(90deg, rgba(232, 160, 84, 0.12) 0%, rgba(232, 160, 84, 0.04) 100%)',
            border: '1px solid rgba(232, 160, 84, 0.3)',
            textDecoration: 'none',
            color: colors.text,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: nextStep.color,
                display: 'grid',
                placeItems: 'center',
                color: '#0e0a05',
              }}
            >
              <nextStep.icon size={22} strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: colors.muted, marginBottom: 3 }}>
                Next Step
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: colors.text }}>
                {nextStep.label}
              </div>
            </div>
          </div>
          <ArrowRight size={20} style={{ color: nextStep.color }} />
        </Link>
      </section>

      {/* Quick Links */}
      <section>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          <Link href="/command-center" style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.07)', textDecoration: 'none', color: colors.text, fontSize: 12.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ExternalLink size={14} style={{ color: colors.muted }} />
            Advanced Dashboard
          </Link>
          <Link href="/company/graph" style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.07)', textDecoration: 'none', color: colors.text, fontSize: 12.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ExternalLink size={14} style={{ color: colors.muted }} />
            Company Graph
          </Link>
          <Link href="/system-health" style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.07)', textDecoration: 'none', color: colors.text, fontSize: 12.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ExternalLink size={14} style={{ color: colors.muted }} />
            System Health
          </Link>
        </div>
      </section>
    </div>
  );
}
