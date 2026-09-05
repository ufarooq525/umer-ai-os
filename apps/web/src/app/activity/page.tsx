import { colors } from '@umer/ui';
import { getAgents, getOpportunities, getRecentAudit, getTasks, getWorkProjects } from '@/lib/control-api';
import { deriveActivityFeed } from '@/lib/company-derive';
import { ActivityFeed } from '@/components/os/ActivityFeed';

export const dynamic = 'force-dynamic';

export default async function ActivityPage() {
  const [opportunities, projects, tasks, agents, auditRecords] = await Promise.all([
    getOpportunities(),
    getWorkProjects(),
    getTasks(),
    getAgents(),
    getRecentAudit(),
  ]);

  const activity = deriveActivityFeed(auditRecords, opportunities, projects, tasks, agents);

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <header>
        <h1 style={{ fontSize: 'clamp(1.5rem, 2.6vw, 2rem)', fontWeight: 650, margin: 0, letterSpacing: '-0.03em' }}>
          Live Activity
        </h1>
        <p style={{ margin: '8px 0 0', color: colors.muted, fontSize: 14 }}>
          Every CEO decision and workflow milestone, translated into plain language. Expand "Technical details" on any
          entry for the raw event.
        </p>
      </header>
      <ActivityFeed entries={activity} pageSize={12} />
    </div>
  );
}
