import { Badge, Card } from '@umer/ui';
import { getRecentAudit } from '@/lib/control-api';
import { describeAuditRecord, partitionAuditRecords } from '@/lib/audit-story';

export const dynamic = 'force-dynamic';

function outcomeTone(outcome: string): 'success' | 'danger' | 'default' {
  if (outcome === 'success') return 'success';
  if (outcome === 'failure') return 'danger';
  return 'default';
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default async function AuditPage() {
  const records = await getRecentAudit();
  const { real, demo } = partitionAuditRecords(records);

  return (
    <>
      <header style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 500, margin: 0 }}>Audit log</h1>
        <p style={{ marginTop: 8, opacity: 0.8, maxWidth: 640 }}>
          A timeline of what the OS did for your projects — approvals, sealed evidence, and
          specialist runs. Project name is the important line; technical IDs stay secondary.
        </p>
      </header>

      <Card title="Your recent work">
        {real.length === 0 ? (
          <p style={{ margin: 0, opacity: 0.7 }}>
            No project work logged yet. Submit a Quick Task or Projects intake, then approve a
            gate — those events land here.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 14 }}>
            {real.map((record) => {
              const story = describeAuditRecord(record);
              return (
                <li
                  key={record.auditId}
                  style={{
                    padding: '14px 0',
                    borderBottom: '1px solid #2d3a4d',
                    fontSize: 14,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <strong style={{ fontSize: 15 }}>{story.title}</strong>
                    <Badge tone={outcomeTone(record.outcome)}>{record.outcome}</Badge>
                  </div>
                  {story.projectLabel ? (
                    <p style={{ margin: '8px 0 0', fontSize: 15 }}>
                      Project: <strong>{story.projectLabel}</strong>
                    </p>
                  ) : null}
                  <p style={{ margin: '6px 0 0', opacity: 0.9 }}>{story.what}</p>
                  <p style={{ margin: '6px 0 0', opacity: 0.55, fontSize: 12 }}>
                    {formatWhen(record.occurredAt)} · {story.technical}
                    {record.correlationId ? ` · ${record.correlationId}` : ''}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {demo.length > 0 ? (
        <section style={{ marginTop: 24 }}>
          <Card title="Demo / sample events (ignore for real work)">
            <p style={{ margin: '0 0 12px', fontSize: 13, opacity: 0.75 }}>
              These are seeded when control-api starts so the Dashboard has something to show.
              They are not from your Quick Tasks.
            </p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
              {demo.map((record) => {
                const story = describeAuditRecord(record);
                return (
                  <li
                    key={record.auditId}
                    style={{
                      padding: '10px 0',
                      borderBottom: '1px solid #2d3a4d',
                      fontSize: 13,
                      opacity: 0.75,
                    }}
                  >
                    <strong>{story.title}</strong>
                    <p style={{ margin: '4px 0 0' }}>{story.what}</p>
                    <p style={{ margin: '4px 0 0', fontSize: 12, opacity: 0.7 }}>
                      {formatWhen(record.occurredAt)} · {story.technical}
                    </p>
                  </li>
                );
              })}
            </ul>
          </Card>
        </section>
      ) : null}
    </>
  );
}
