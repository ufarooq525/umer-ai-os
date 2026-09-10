import { notFound } from 'next/navigation';
import Link from 'next/link';
import { colors } from '@umer/ui';
import { loadOpportunityDetail } from '@/lib/opportunity-detail';
import { OpportunityDetailBody } from '@/components/os/OpportunityDetailBody';
import { CompanySubNav } from '@/components/os/CompanySubNav';
import { LocalGraphPanel } from '@/components/os/LocalGraphPanel';

export const dynamic = 'force-dynamic';

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const model = await loadOpportunityDetail(id, { includeNeighbors: true });
  if (!model) notFound();

  return (
    <div style={{ display: 'grid', gap: 24, maxWidth: 1400, margin: '0 auto' }}>
      <CompanySubNav />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap', borderBottom: `1px solid ${colors.border}`, paddingBottom: 14 }}>
        <Link href="/company/opportunities" style={{ fontSize: 13, color: colors.muted, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>←</span> Back to Opportunities
        </Link>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Link
            href={`/company/graph?q=${encodeURIComponent(model.opportunity.title)}`}
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: colors.accent,
              textDecoration: 'none',
              padding: '6px 12px',
              borderRadius: 6,
              background: colors.accentSoft,
              border: `1px solid rgba(255, 255, 255, 0.08)`,
            }}
          >
            ⬡ View in Company Graph
          </Link>
          <Link
            href="/sales"
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: colors.text,
              textDecoration: 'none',
              padding: '6px 12px',
              borderRadius: 6,
              background: 'rgba(255, 255, 255, 0.05)',
              border: `1px solid ${colors.border}`,
            }}
          >
            Go to Sales Pipeline →
          </Link>
        </div>
      </div>

      <OpportunityDetailBody model={model} />

      <LocalGraphPanel
        focusLabel={model.opportunity.title}
        focusType="Opportunity"
        scope={{ opportunityId: model.opportunity.id }}
      />
    </div>
  );
}

