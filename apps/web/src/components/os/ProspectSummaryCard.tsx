import Link from 'next/link';
import { colors, fonts, radii } from '@umer/ui';
import type { NicheProspectSummary } from '@/lib/control-api';

/** Compact card for "other prospects discovered in this run" — deliberately not styled as belonging to a specific opportunity. */
export function ProspectSummaryCard({ prospect }: { prospect: NicheProspectSummary }) {
  const name = prospect.business?.name ?? prospect.candidate.name;
  return (
    <Link
      href={`/company/prospects/${prospect.businessId}`}
      style={{
        display: 'block',
        padding: 12,
        borderRadius: radii.md,
        border: `1px solid ${colors.border}`,
        background: colors.surface,
        textDecoration: 'none',
        color: colors.text,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <strong style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</strong>
        {prospect.bestScore > 0 ? (
          <span style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.accent, flexShrink: 0 }}>{prospect.bestScore}</span>
        ) : null}
      </div>
      <div style={{ fontSize: 11, color: colors.muted, marginTop: 4 }}>
        {prospect.candidate.geography}
        {prospect.opportunityCount > 0 ? ` · ${prospect.opportunityCount} opportunit${prospect.opportunityCount === 1 ? 'y' : 'ies'}` : ' · no qualified opportunity'}
      </div>
      <div style={{ fontSize: 11, marginTop: 4, color: prospect.hasContactChannel ? colors.success : colors.warning }}>
        {prospect.hasContactChannel ? '✓ contact channel available' : '⚠ no contact channel found'}
      </div>
    </Link>
  );
}
