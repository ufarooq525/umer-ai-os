import { colors } from '@umer/ui';
import { getAgents, getOpportunities, getTasks, getWorkProjects } from '@/lib/control-api';
import { CeoDecisionPlane } from '@/components/CeoDecisionPlane';

export const dynamic = 'force-dynamic';

export default async function DecisionsPage() {
  const [opportunities, projects, tasks, agents] = await Promise.all([
    getOpportunities(),
    getWorkProjects(),
    getTasks(),
    getAgents(),
  ]);

  return (
    <>
      <header style={{ marginBottom: 28 }}>
        <p
          style={{
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: colors.muted,
            fontSize: 11,
            fontWeight: 600,
            margin: 0,
          }}
        >
          CEO Command &amp; Decision Plane
        </p>
        <h1 style={{ fontSize: 'clamp(1.75rem, 3vw, 2.25rem)', fontWeight: 650, margin: '8px 0 0', letterSpacing: '-0.03em' }}>
          Decisions
        </h1>
        <p style={{ marginTop: 8, color: colors.muted, fontSize: 14, maxWidth: 720, lineHeight: 1.5 }}>
          Select or reject an Opportunity, turn a selected one into a Project, then run the
          Project through its lifecycle and assign the work. Every action here goes through{' '}
          <code>POST /v1/commands</code> — authorized, idempotent, and appended to the{' '}
          <a href="/audit" style={{ color: colors.accent }}>
            Audit
          </a>{' '}
          trail.
        </p>
      </header>
      <CeoDecisionPlane opportunities={opportunities} projects={projects} tasks={tasks} agents={agents} />
    </>
  );
}
