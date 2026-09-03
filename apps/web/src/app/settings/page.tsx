import Link from 'next/link';
import { Card, colors, fonts } from '@umer/ui';
import { controlApiBaseUrl } from '@/lib/control-api';

export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <header>
        <h1 style={{ fontSize: 'clamp(1.5rem, 2.6vw, 2rem)', fontWeight: 650, margin: 0, letterSpacing: '-0.03em' }}>
          Settings
        </h1>
      </header>

      <Card title="Acting as (CEO identity)">
        <p style={{ margin: 0, fontSize: 13, color: colors.text, lineHeight: 1.6 }}>
          There is no login yet — every command is sent as trusted client input. Set the principal id and kind used
          for commands directly in{' '}
          <Link href="/decisions" style={{ color: colors.accent }}>
            Decisions
          </Link>{' '}
          (defaults to <code style={{ fontFamily: fonts.mono }}>human.ceo</code>).
        </p>
      </Card>

      <Card title="Environment">
        <div style={{ fontSize: 13, display: 'grid', gap: 6 }}>
          <div>
            <span style={{ color: colors.muted }}>Control API: </span>
            <code style={{ fontFamily: fonts.mono }}>{controlApiBaseUrl()}</code>
          </div>
        </div>
      </Card>
    </div>
  );
}
