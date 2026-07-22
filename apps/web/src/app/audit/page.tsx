import { Badge, Card } from '@umer/ui';
import { getRecentAudit } from '@/lib/control-api';

export const dynamic = 'force-dynamic';

function outcomeTone(outcome: string): 'success' | 'danger' | 'default' {
  if (outcome === 'success') return 'success';
  if (outcome === 'failure') return 'danger';
  return 'default';
}

export default async function AuditPage() {
  const records = await getRecentAudit();

  return (
    <>
      <header style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 500, margin: 0 }}>Audit log</h1>
        <p style={{ marginTop: 8, opacity: 0.8 }}>Recent append-only audit records from the runtime.</p>
      </header>

      <Card title="Recent events">
        {records.length === 0 ? (
          <p style={{ margin: 0, opacity: 0.7 }}>No audit records yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
            {records.map((record) => (
              <li
                key={record.auditId}
                style={{
                  padding: '12px 0',
                  borderBottom: '1px solid #2d3a4d',
                  fontSize: 14,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <strong>{record.action}</strong>
                  <Badge tone={outcomeTone(record.outcome)}>{record.outcome}</Badge>
                </div>
                <p style={{ margin: '6px 0 0', opacity: 0.8 }}>
                  {record.actor} · {record.resourceType}/{record.resourceId}
                </p>
                <p style={{ margin: '4px 0 0', opacity: 0.6, fontSize: 12 }}>
                  {record.occurredAt}
                  {record.correlationId ? ` · corr ${record.correlationId}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
