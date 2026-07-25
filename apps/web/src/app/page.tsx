import { Badge, Card } from '@umer/ui';
import { getDashboard, getProjects, getWorkPackages } from '@/lib/control-api';
import { QuickTaskForm } from '@/components/QuickTaskForm';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [summary, workPackages, { projects }] = await Promise.all([
    getDashboard(),
    getWorkPackages(),
    getProjects(),
  ]);

  return (
    <>
      <header style={{ marginBottom: 32 }}>
        <p style={{ letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.7, fontSize: 12 }}>
          Control plane
        </p>
        <h1 style={{ fontSize: '2rem', fontWeight: 500, margin: '0.5rem 0 0' }}>Dashboard</h1>
      </header>

      <section style={{ marginBottom: 32 }}>
        <QuickTaskForm projects={projects} />
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <Card title="Pending gates">
          <p style={{ fontSize: 32, margin: 0, fontWeight: 600 }}>{summary.pendingGates}</p>
        </Card>
        <Card title="Awaiting review">
          <p style={{ fontSize: 32, margin: 0, fontWeight: 600 }}>
            {summary.workPackagesAwaitingReview}
          </p>
        </Card>
        <Card title="Resolved today">
          <p style={{ fontSize: 32, margin: 0, fontWeight: 600 }}>{summary.resolvedToday}</p>
        </Card>
      </div>

      <section style={{ marginTop: 32 }}>
        <Card title="Work packages">
          {workPackages.length === 0 ? (
            <p style={{ margin: 0, opacity: 0.7 }}>No work packages in the demo state.</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
              {workPackages.map((wp) => (
                <li
                  key={wp.workPackageId}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 0',
                    borderBottom: '1px solid #2d3a4d',
                  }}
                >
                  <div>
                    <strong>{wp.workPackageId}</strong>
                    <p style={{ margin: '4px 0 0', fontSize: 14, opacity: 0.8 }}>
                      {wp.specialistId} · {wp.stage}
                    </p>
                  </div>
                  <Badge tone={wp.status === 'AwaitingReview' ? 'warning' : 'default'}>
                    {wp.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </>
  );
}
