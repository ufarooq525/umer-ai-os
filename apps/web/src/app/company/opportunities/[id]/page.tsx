import { notFound } from 'next/navigation';
import Link from 'next/link';
import { colors } from '@umer/ui';
import { loadOpportunityDetail } from '@/lib/opportunity-detail';
import { OpportunityDetailBody } from '@/components/os/OpportunityDetailBody';

export const dynamic = 'force-dynamic';

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const model = await loadOpportunityDetail(id, { includeNeighbors: true });
  if (!model) notFound();

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <Link href={`/company/opportunities?open=${id}`} style={{ fontSize: 12, color: colors.muted, textDecoration: 'none' }}>
          ← Back to list (dialog)
        </Link>
        <Link
          href={`/company/graph?q=${encodeURIComponent(model.opportunity.title)}`}
          style={{ fontSize: 12, color: colors.accent, textDecoration: 'none' }}
        >
          ⬡ View in Company Graph
        </Link>
      </div>
      <OpportunityDetailBody model={model} />
    </div>
  );
}
