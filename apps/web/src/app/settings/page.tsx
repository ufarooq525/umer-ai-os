import Link from 'next/link';
import { Card, colors, fonts } from '@umer/ui';
import { controlApiBaseUrl } from '@/lib/control-api';
import {
  founderSignatureHtml,
  founderSignatureText,
  UMER_CAL_URL,
  UMER_FOUNDER_EMAIL,
  UMER_FOUNDER_NAME,
  UMER_SITE_URL,
  UMER_TITLE,
} from '@/lib/founder-identity';

export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <header>
        <h1 style={{ fontSize: 'clamp(1.5rem, 2.6vw, 2rem)', fontWeight: 650, margin: 0, letterSpacing: '-0.03em' }}>
          Settings
        </h1>
      </header>

      <Card title="Founder email">
        <p style={{ margin: '0 0 10px', fontSize: 14, lineHeight: 1.6 }}>
          Use <strong>{UMER_FOUNDER_EMAIL}</strong> as the public address. It reads as the owner, not a helpdesk.
          Point it at your inbox (Google Workspace or a catch-all on umerfarooqtech.com). Also add{' '}
          <code style={{ fontFamily: fonts.mono }}>hello@umerfarooqtech.com</code> as an alias for inbound only.
        </p>
        <p style={{ margin: 0, fontSize: 13, color: colors.muted, lineHeight: 1.5 }}>
          Do not send client mail from Gmail. SPF, DKIM, and DMARC on the domain are required before outreach, or
          messages land in spam.
        </p>
      </Card>

      <Card title="Email signature (plain text)">
        <pre
          style={{
            margin: 0,
            fontFamily: fonts.mono,
            fontSize: 12,
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
            color: colors.text,
          }}
        >
          {founderSignatureText()}
        </pre>
      </Card>

      <Card title="Email signature (HTML — paste into Gmail / Workspace)">
        <div
          dangerouslySetInnerHTML={{ __html: founderSignatureHtml() }}
          style={{ padding: 12, background: '#f7f3ea', borderRadius: 8, color: '#1a1208' }}
        />
        <p style={{ margin: '12px 0 0', fontSize: 12, color: colors.muted }}>
          {UMER_FOUNDER_NAME} · {UMER_TITLE} · {UMER_SITE_URL} · {UMER_CAL_URL}
        </p>
      </Card>

      <Card title="Acting as (CEO identity)">
        <p style={{ margin: 0, fontSize: 13, color: colors.text, lineHeight: 1.6 }}>
          There is no login yet — every command is sent as trusted client input. Set the principal id used for
          commands in{' '}
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
