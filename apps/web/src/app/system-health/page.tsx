import { Card, colors, fonts } from '@umer/ui';
import { getAgents, getHealth, getTasks, getWorkProjects } from '@/lib/control-api';
import { StatusBadge } from '@/components/os/StatusBadge';

export const dynamic = 'force-dynamic';

export default async function SystemHealthPage() {
  const [health, agents, projects, tasks] = await Promise.all([getHealth(), getAgents(), getWorkProjects(), getTasks()]);

  const workingAgents = agents.filter((a) => a.status === 'active' && a.controlState === 'active').length;
  const blockedTasks = tasks.filter((t) => t.status === 'Blocked').length;

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <header>
        <h1 style={{ fontSize: 'clamp(1.5rem, 2.6vw, 2rem)', fontWeight: 650, margin: 0, letterSpacing: '-0.03em' }}>
          System Health
        </h1>
        <p style={{ margin: '8px 0 0', color: colors.muted, fontSize: 14, maxWidth: 640, lineHeight: 1.5 }}>
          There is no infrastructure metrics endpoint (CPU, queue depth, latency) yet — this page shows control-api
          liveness plus stats derived from the entities already on this dashboard.
        </p>
      </header>

      <Card title="control-api">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <StatusBadge tone={health ? 'working' : 'failed'} label={health ? 'REACHABLE' : 'UNREACHABLE'} />
          {health ? (
            <span style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.muted }}>
              {health.service} · {health.status}
            </span>
          ) : null}
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <Card title="Agents">
          <p style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>
            {agents.length > 0 ? Math.round((workingAgents / agents.length) * 100) : 0}%
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: colors.muted }}>working right now</p>
        </Card>
        <Card title="Projects">
          <p style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>{projects.filter((p) => p.status === 'Active').length}</p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: colors.muted }}>active</p>
        </Card>
        <Card title="Tasks">
          <p style={{ margin: 0, fontSize: 24, fontWeight: 700, color: blockedTasks > 0 ? colors.warning : colors.text }}>
            {blockedTasks}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: colors.muted }}>blocked</p>
        </Card>
      </div>
    </div>
  );
}
