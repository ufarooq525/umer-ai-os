import { Badge, Card, colors, fonts } from '@umer/ui';
import { getDashboard, getProjects, getWorkPackages } from '@/lib/control-api';
import { QuickTaskForm } from '@/components/QuickTaskForm';
import { OpportunityControlCenter } from '@/components/OpportunityControlCenter';
import { AIWorkforceCommandCenter } from '@/components/AIWorkforceCommandCenter';
import { WatchdogFindingsBanner } from '@/components/WatchdogFindingsBanner';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [summary, workPackages, { projects }] = await Promise.all([
    getDashboard(),
    getWorkPackages(),
    getProjects(),
  ]);

  const watchdogFindings = summary.watchdogFindings ?? [];

  return (
    <>
      <header style={{ marginBottom: 28 }}>
        <p style={{ letterSpacing: '0.14em', textTransform: 'uppercase', color: colors.muted, fontSize: 11, fontWeight: 600, margin: 0 }}>
          Umer AI OS · autonomous revenue control
        </p>
        <h1 style={{ fontSize: 'clamp(1.75rem, 3vw, 2.4rem)', fontWeight: 650, margin: '8px 0 0', letterSpacing: '-0.03em' }}>
          Mission Control
        </h1>
        <p style={{ margin: '10px 0 0', color: colors.muted, fontSize: 14, maxWidth: 720, lineHeight: 1.5 }}>
          Watch the agents work instead of staring at yesterday&apos;s records. Start an intelligence run and follow every stage as it happens.
        </p>
      </header>

      <AIWorkforceCommandCenter />
      <OpportunityControlCenter />

      <section style={{ marginTop: 28, marginBottom: 28 }}>
        <WatchdogFindingsBanner findings={watchdogFindings} />
        <QuickTaskForm projects={projects} />
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
        <Card title="Pending gates"><p style={{ fontSize: 36, margin: 0, fontWeight: 650, letterSpacing: '-0.04em' }}>{summary.pendingGates}</p></Card>
        <Card title="Awaiting review"><p style={{ fontSize: 36, margin: 0, fontWeight: 650, letterSpacing: '-0.04em' }}>{summary.workPackagesAwaitingReview}</p></Card>
        <Card title="Resolved today"><p style={{ fontSize: 36, margin: 0, fontWeight: 650, letterSpacing: '-0.04em' }}>{summary.resolvedToday}</p></Card>
      </div>

      <section style={{ marginTop: 28 }}>
        <Card title="Current work packages">
          {workPackages.length === 0 ? (
            <p style={{ margin: 0, color: colors.muted }}>No open work packages.</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 4 }}>
              {workPackages.map((wp) => (
                <li key={wp.workPackageId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '14px 4px', borderBottom: `1px solid ${colors.border}` }}>
                  <div><strong style={{ fontFamily: fonts.mono, fontSize: 13 }}>{wp.workPackageId}</strong><p style={{ margin: '4px 0 0', fontSize: 13, color: colors.muted }}>{wp.specialistId} · {wp.stage}</p></div>
                  <Badge tone={wp.status === 'AwaitingReview' ? 'warning' : 'default'}>{wp.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </>
  );
}