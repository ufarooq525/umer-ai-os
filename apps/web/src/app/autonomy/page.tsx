import Link from 'next/link';
import { Card, colors, fonts } from '@umer/ui';
import { getAgents } from '@/lib/control-api';
import { humanizeSpecialistId } from '@/components/os/format';

export const dynamic = 'force-dynamic';

export default async function AutonomyPage() {
  const agents = await getAgents();
  const byDepartment = new Map<string, typeof agents>();
  for (const agent of agents) {
    const key = agent.department ?? humanizeSpecialistId(agent.specialistId);
    byDepartment.set(key, [...(byDepartment.get(key) ?? []), agent]);
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <header>
        <h1 style={{ fontSize: 'clamp(1.5rem, 2.6vw, 2rem)', fontWeight: 650, margin: 0, letterSpacing: '-0.03em' }}>
          Autonomy
        </h1>
        <p style={{ margin: '8px 0 0', color: colors.muted, fontSize: 14, maxWidth: 640 }}>
          Every command in this system flows through the same CEO Command &amp; Decision Plane, whether it's issued by
          a human or, in a future milestone, an Autonomous CEO agent — same commands, same state, same events, same
          dashboard.
        </p>
      </header>

      <Card title="CEO">
        <div id="ceo" />
        <p style={{ margin: 0, fontSize: 13, color: colors.text, lineHeight: 1.6 }}>
          Today the CEO seat is a human, acting through{' '}
          <Link href="/decisions" style={{ color: colors.accent }}>
            Decisions
          </Link>
          . Every command is authorized by <code style={{ fontFamily: fonts.mono }}>@umer/trust</code>'s default-deny
          runtime — only the configured CEO principal is granted command authority. An Autonomous CEO agent is a
          planned future milestone; it will issue the same commands through the same plane, not a separate mechanism.
        </p>
      </Card>

      <Card title="Specialists">
        <div id="specialists" />
        {byDepartment.size === 0 ? (
          <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>No agents registered yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {[...byDepartment.entries()].map(([label, group]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderBottom: `1px solid ${colors.border}` }}>
                <span>{label}</span>
                <span style={{ color: colors.muted, fontFamily: fonts.mono }}>{group.length}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Policies">
        <div id="policies" />
        <p style={{ margin: 0, fontSize: 13, color: colors.text, lineHeight: 1.6 }}>
          Command authorization, idempotency and audit are enforced centrally by the Command Plane for every command
          — there is no per-page policy override. A dedicated policy editor is out of scope for this milestone.
        </p>
      </Card>
    </div>
  );
}
