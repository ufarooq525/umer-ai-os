import { Card, colors, fonts } from '@umer/ui';
import type { ContactChannel } from '@/lib/commercial-intelligence';

const TYPE_LABEL: Record<ContactChannel['type'], string> = {
  website: 'Website',
  phone: 'Phone',
  whatsapp: 'WhatsApp',
  email: 'Email',
  address: 'Address',
};

const TYPE_ICON: Record<ContactChannel['type'], string> = {
  website: '🌐',
  phone: '📞',
  whatsapp: '💬',
  email: '✉',
  address: '📍',
};

const CONFIDENCE_COLOR: Record<ContactChannel['confidence'], string> = {
  high: colors.success,
  medium: colors.warning,
  low: colors.muted,
  unknown: colors.muted,
};

/**
 * Every value here traces to a real field (Google-Places-sourced phone/
 * address/website, or an explicit sourceRefs email: reference) — an unknown
 * channel renders as "Not discovered," never a fabricated value, and
 * `verified` is always false since nothing in the pipeline confirms
 * reachability today.
 */
export function ContactChannelCard({ channels }: { channels: ContactChannel[] }) {
  return (
    <Card title="Contact Intelligence">
      <div style={{ display: 'grid', gap: 2 }}>
        {channels.map((c) => (
          <div
            key={c.type}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10,
              padding: '8px 0',
              borderBottom: `1px solid ${colors.border}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span aria-hidden>{TYPE_ICON[c.type]}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{TYPE_LABEL[c.type]}</div>
                <div
                  style={{
                    fontSize: 12,
                    color: c.value ? colors.text : colors.muted,
                    fontFamily: c.value ? fonts.mono : fonts.sans,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: 220,
                  }}
                >
                  {c.value ?? 'Not discovered'}
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div
                style={{
                  fontSize: 10,
                  fontFamily: fonts.mono,
                  color: CONFIDENCE_COLOR[c.confidence],
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                {c.confidence}
              </div>
              {c.source ? <div style={{ fontSize: 10, color: colors.muted, maxWidth: 140 }}>{c.source}</div> : null}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
