import { colors } from '@umer/ui';
import { MarketScanBoard } from '@/components/os/MarketScanBoard';

export const dynamic = 'force-dynamic';

export default function MarketsPage() {
  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <header>
        <p style={{ letterSpacing: '0.14em', textTransform: 'uppercase', color: colors.muted, fontSize: 11, fontWeight: 600, margin: 0 }}>
          Strategy
        </p>
        <h1 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', fontWeight: 650, margin: '8px 0 0', letterSpacing: '-0.03em' }}>
          Markets
        </h1>
        <p style={{ margin: '10px 0 0', color: colors.muted, fontSize: 14, maxWidth: 680, lineHeight: 1.55 }}>
          Pick a city and a kind of shop. Rank by listing volume and missing official websites. Approve one market, then hunt
          operators. The same desk works for a Karachi travel agency and a Makkah Umrah office.
        </p>
      </header>
      <MarketScanBoard variant="full" />
    </div>
  );
}