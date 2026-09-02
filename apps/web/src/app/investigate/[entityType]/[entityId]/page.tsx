import Link from 'next/link';
import { Card, colors, fonts } from '@umer/ui';
import { getRevenueLineage } from '@/lib/revenue-lineage-api';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ entityType: string; entityId: string }> };

export default async function InvestigationPage({ params }: Props) {
  const { entityType, entityId } = await params;
  let data: Awaited<ReturnType<typeof getRevenueLineage>> | null = null; let error: string | null = null;
  try { data = await getRevenueLineage(entityType, entityId); } catch (e) { error = e instanceof Error ? e.message : String(e); }
  return <main><Link href="/" style={{ color: colors.text, fontSize: 12 }}>← Mission Control</Link><h1 style={{ margin: '12px 0 6px', fontSize: 26 }}>Entity Investigation</h1><p style={{ color: colors.muted, fontSize: 12 }}>{entityType} · <span style={{ fontFamily: fonts.mono }}>{entityId}</span></p>{error ? <Card title="Investigation error"><p style={{ color: colors.danger }}>{error}</p></Card> : data ? <div style={{ display: 'grid', gap: 14 }}><Card title="Lineage"><p style={{ margin: 0, color: colors.muted, fontSize: 12 }}>AI tracked cost: ${Number(data.trackedCost).toFixed(4)}</p>{data.edges.length ? data.edges.map((edge, i) => <div key={`${String(edge.lineage_id ?? 'edge')}-${i}`} style={{ padding: 10, borderBottom: `1px solid ${colors.border}`, fontSize: 12 }}><strong>{String(edge.from_type)}/{String(edge.from_id)}</strong> <span style={{ color: colors.muted }}>—{String(edge.relation)}→</span> <strong>{String(edge.to_type)}/{String(edge.to_id)}</strong></div>) : <p style={{ color: colors.muted }}>No lineage edges recorded yet.</p>}</Card><Card title="Business outcomes">{data.outcomes.length ? data.outcomes.map(o => <div key={String(o.outcome_id)} style={{ padding: 9, borderBottom: `1px solid ${colors.border}`, fontSize: 12 }}>{String(o.outcome_type)} · {String(o.status)} · {o.amount == null ? 'amount pending' : `${String(o.amount)} ${String(o.currency)}`}</div>) : <p style={{ color: colors.muted }}>No outcomes recorded.</p>}</Card></div> : null}</main>;
}
