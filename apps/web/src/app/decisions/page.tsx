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
          Where the company needs you
        </p>
        <h1 style={{ fontSize: 'clamp(1.75rem, 3vw, 2.25rem)', fontWeight: 650, margin: '8px 0 0', letterSpacing: '-0.03em' }}>
          CEO Decision Center
        </h1>
        <p style={{ marginTop: 8, color: colors.muted, fontSize: 14, maxWidth: 720, lineHeight: 1.5 }}>
          Review and act on what the company has found, then create and run projects from what you approve. Every
          action here is authorized, recorded once, and kept in the{' '}
          <a href="/audit" style={{ color: colors.accent }}>
            audit trail
          </a>
          .
        </p>
      </header>
      <CeoDecisionPlane opportunities={opportunities} projects={projects} tasks={tasks} agents={agents} />
    </>
  );
}
