'use client';

import { useEffect, useState } from 'react';
import { Card, colors, fonts } from '@umer/ui';
import type { ContactChannel } from '@/lib/commercial-intelligence';
import type { WebsiteProbe } from '@/lib/website-probe';

const TYPE_LABEL: Record<ContactChannel['type'], string> = {
  website: 'Website',
  phone: 'Phone',
  whatsapp: 'WhatsApp',
  email: 'Email',
  address: 'Address',
  maps: 'Google Maps',
};

const TYPE_ICON: Record<ContactChannel['type'], string> = {
  website: '🌐',
  phone: '📞',
  whatsapp: '💬',
  email: '✉',
  address: '📍',
  maps: '🗺',
};

const CONFIDENCE_COLOR: Record<ContactChannel['confidence'], string> = {
  high: colors.success,
  medium: colors.warning,
  low: colors.muted,
  unknown: colors.muted,
};

/**
 * Values come from Google Places / sourceRefs. Website reachability is probed
 * live when a URL exists. Maps photo URLs (e.g. on a shop sign) are not OCR'd.
 */
export function ContactChannelCard({ channels }: { channels: ContactChannel[] }) {
  const website = channels.find((c) => c.type === 'website')?.value;
  const [probe, setProbe] = useState<WebsiteProbe | null>(null);

  useEffect(() => {
    if (!website) {
      setProbe(null);
      return;
    }
    let alive = true;
    void fetch(`/api/website-probe?url=${encodeURIComponent(website)}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data: WebsiteProbe) => {
        if (alive) setProbe(data);
      })
      .catch(() => {
        if (alive) setProbe({ url: website, reachable: false, status: null, finalUrl: null, error: 'probe failed' });
      });
    return () => {
      alive = false;
    };
  }, [website]);

  return (
    <Card title="Contact Intelligence">
      <div style={{ display: 'grid', gap: 2 }}>
        {channels.map((c) => {
          const live =
            c.type === 'website' && c.value && probe
              ? probe.reachable
                ? 'SITE UP'
                : 'SITE DOWN'
              : c.type === 'website' && c.value && !probe
                ? 'CHECKING'
                : null;
          return (
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
                      maxWidth: 240,
                    }}
                  >
                    {c.href && c.value ? (
                      <a href={c.href} target="_blank" rel="noreferrer" style={{ color: colors.accent, textDecoration: 'none' }}>
                        {c.type === 'maps' ? 'Open listing to verify →' : c.value}
                      </a>
                    ) : (
                      (c.value ?? (c.type === 'website' ? 'No official website on the listing' : 'Not discovered'))
                    )}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                {live ? (
                  <div
                    style={{
                      fontSize: 10,
                      fontFamily: fonts.mono,
                      color: live === 'SITE UP' ? colors.success : live === 'SITE DOWN' ? colors.danger : colors.muted,
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                    }}
                  >
                    {live}
                  </div>
                ) : (
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
                )}
                {c.source ? <div style={{ fontSize: 10, color: colors.muted, maxWidth: 160 }}>{c.source}</div> : null}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
