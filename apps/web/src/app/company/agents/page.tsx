import Link from 'next/link';
import { Bot, Sparkles, LayoutGrid } from 'lucide-react';
import { colors, fonts } from '@umer/ui';
import { getAgentRuns, getAgents, getTasks, getWorkProjects } from '@/lib/control-api';
import { AgentCard } from '@/components/os/AgentCard';
import { PagedChildren } from '@/components/os/PagedChildren';
import { agentCurrentRun, agentCurrentTask, agentProjectName } from '@/components/os/joins';
import { CompanySubNav } from '@/components/os/CompanySubNav';

export const dynamic = 'force-dynamic';

export default async function AgentsPage() {
  const [agents, tasks, projects, agentRuns] = await Promise.all([
    getAgents(),
    getTasks(),
    getWorkProjects(),
    getAgentRuns(),
  ]);

  // An agent whose current run keeps failing (e.g. no mandate registered)
  // isn't meaningfully "working" even though it's technically active —
  // surface it as blocked instead of a misleading clean WORKING count.
  const isBlocked = (agent: (typeof agents)[number]) => {
    const run = agentCurrentRun(agent, agentRuns);
    return !!(run && run.failures.length > 0);
  };
  const activeAgents = agents.filter((a) => a.status === 'active' && a.controlState === 'active');
  const blockedAgents = activeAgents.filter(isBlocked);
  const workingAgents = activeAgents.filter((a) => !isBlocked(a));
  const idleAgents = agents.filter((a) => a.status !== 'active' || a.controlState !== 'active');

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <header>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 'clamp(1.5rem, 2.6vw, 2.1rem)', fontWeight: 650, margin: 0, letterSpacing: '-0.035em', color: '#ffffff' }}>
              AI Workforce ({agents.length})
            </h1>
            <p style={{ margin: '8px 0 0', color: colors.muted, fontSize: 14 }}>
              Who is working right now across projects, tasks, and autonomy loops.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span
              style={{
                fontFamily: fonts.mono,
                fontSize: 12,
                fontWeight: 650,
                padding: '4px 10px',
                borderRadius: 8,
                background: workingAgents.length > 0 ? 'rgba(93, 206, 160, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                color: workingAgents.length > 0 ? colors.success : colors.muted,
                border: `1px solid ${workingAgents.length > 0 ? 'rgba(93, 206, 160, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
              }}
            >
              {workingAgents.length} WORKING
            </span>
            {blockedAgents.length > 0 && (
              <span
                style={{
                  fontFamily: fonts.mono,
                  fontSize: 12,
                  fontWeight: 650,
                  padding: '4px 10px',
                  borderRadius: 8,
                  background: 'rgba(240, 113, 120, 0.12)',
                  color: colors.danger,
                  border: '1px solid rgba(240, 113, 120, 0.3)',
                }}
              >
                {blockedAgents.length} BLOCKED
              </span>
            )}
            <span
              style={{
                fontFamily: fonts.mono,
                fontSize: 12,
                fontWeight: 650,
                padding: '4px 10px',
                borderRadius: 8,
                background: 'rgba(255, 255, 255, 0.04)',
                color: colors.muted,
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              {idleAgents.length} IDLE / STANDBY
            </span>
          </div>
        </div>
      </header>

      <CompanySubNav />

      {agents.length === 0 ? (
        <div
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            borderRadius: 16,
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'grid',
            gap: 14,
            placeItems: 'center',
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.04)',
              display: 'grid',
              placeItems: 'center',
              color: colors.muted,
            }}
          >
            <Bot size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 650, color: colors.text, margin: '0 0 6px' }}>
              NO ACTIVE WORK
            </h2>
            <p style={{ margin: 0, color: colors.muted, fontSize: 13, maxWidth: 500, lineHeight: 1.6 }}>
              There are currently no executing Work Packages registered in the system. The company is waiting for executable work or opportunity dispatch.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <Link
              href="/company/opportunities"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                borderRadius: 8,
                background: colors.accent,
                color: '#1a1208',
                fontWeight: 700,
                fontSize: 12.5,
                textDecoration: 'none',
              }}
            >
              <Sparkles size={14} /> View Opportunities
            </Link>
            <Link
              href="/company/projects"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                borderRadius: 8,
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: colors.text,
                fontWeight: 500,
                fontSize: 12.5,
                textDecoration: 'none',
              }}
            >
              <LayoutGrid size={14} /> View Projects
            </Link>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 20 }}>
          <PagedChildren pageSize={12} minItemWidth={300}>
            {/* Working agents first, then idle agents */}
            {/* Blocked agents need CEO attention first, then active work, then standby. */}
            {[...blockedAgents, ...workingAgents, ...idleAgents].map((agent) => (
              <AgentCard
                key={agent.agentId}
                agent={agent}
                run={agentCurrentRun(agent, agentRuns)}
                currentTaskTitle={agentCurrentTask(agent, tasks)?.title}
                projectName={agentProjectName(agent, tasks, projects)}
              />
            ))}
          </PagedChildren>
        </div>
      )}
    </div>
  );
}
