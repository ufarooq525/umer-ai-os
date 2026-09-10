'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { colors, fonts, radii } from '@umer/ui';
import type { OpportunityDetailModel } from '@/lib/opportunity-detail';
import type { ContactChannel } from '@/lib/commercial-intelligence';
import { OUTREACH_STATUS_META } from './FiledDraftsCard';
import { formatRelativeTime } from './format';

const CHANNEL_TYPE_LABEL: Record<ContactChannel['type'], string> = {
  website: 'Website',
  phone: 'Phone',
  whatsapp: 'WhatsApp',
  email: 'Email',
  address: 'Address',
  maps: 'Google Maps',
  facebook: 'Facebook',
  instagram: 'Instagram',
  twitter: 'X/Twitter',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  tiktok: 'TikTok',
};

const SOCIAL_TYPES = new Set<ContactChannel['type']>(['facebook', 'instagram', 'twitter', 'linkedin', 'youtube', 'tiktok']);

/**
 * Answers "who was contacted, how, and what happened" directly inside a
 * quick-inspection drawer — fetched on demand per opportunity rather than
 * prefetched for every card on the board, since it's N+1 against the
 * control API otherwise.
 */
export function OutreachIntelPanel({ opportunityId }: { opportunityId: string }) {
  const [model, setModel] = useState<OpportunityDetailModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setModel(null);
    void fetch(`/api/company/opportunities/${encodeURIComponent(opportunityId)}`, { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error('Could not load outreach detail');
        return r.json() as Promise<OpportunityDetailModel>;
      })
      .then((data) => {
        if (alive) setModel(data);
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : 'Load failed');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [opportunityId]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 0', color: colors.muted, fontSize: 12.5 }}>
        <Loader2 size={14} className="spin" style={{ animation: 'spin 0.8s linear infinite' }} />
        Loading outreach &amp; contact detail…
        <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
      </div>
    );
  }

  if (error || !model) {
    return (
      <p style={{ fontSize: 12.5, color: colors.muted, margin: 0 }}>
        {error ?? 'No outreach detail available for this opportunity.'}
      </p>
    );
  }

  const { contactChannels, filedDrafts } = model;
  const reachableChannels = contactChannels.filter((c) => c.value);
  const sent = filedDrafts.filter((d) => d.status !== 'drafted' && d.status !== 'ready');
  const responded = filedDrafts.filter((d) => d.status === 'replied' || d.status === 'converted');

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Contact Intelligence — how THEY can be reached */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: colors.accent, letterSpacing: '0.08em', marginBottom: 8 }}>
          Discovered Contact Channels
        </div>
        {reachableChannels.length === 0 ? (
          <p style={{ fontSize: 12.5, color: colors.muted, margin: 0 }}>No contact channels discovered for this prospect yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {reachableChannels.some((c) => SOCIAL_TYPES.has(c.type)) && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  padding: '8px 10px',
                  borderRadius: radii.sm,
                  border: `1px solid ${colors.warning}55`,
                  background: `${colors.warning}14`,
                  fontSize: 11.5,
                  color: colors.text,
                  lineHeight: 1.4,
                }}
              >
                <span aria-hidden>⚠</span>
                <span>Social links found on their own website — unverified as active. Confirm before contacting.</span>
              </div>
            )}
            {reachableChannels.map((c) => (
              <div
                key={c.type}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 10px',
                  borderRadius: radii.sm,
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  fontSize: 12.5,
                }}
              >
                <span style={{ color: colors.muted, fontWeight: 600 }}>{CHANNEL_TYPE_LABEL[c.type]}</span>
                {c.href ? (
                  <a href={c.href} target="_blank" rel="noreferrer" style={{ color: colors.accent, fontFamily: fonts.mono, fontSize: 12, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240 }}>
                    {c.value}
                  </a>
                ) : (
                  <span style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.text }}>{c.value}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Outreach & response — what WE sent and what happened */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: colors.accent, letterSpacing: '0.08em', marginBottom: 8 }}>
          Outreach &amp; Response
        </div>
        {filedDrafts.length === 0 ? (
          <p style={{ fontSize: 12.5, color: colors.muted, margin: 0 }}>No outreach has been drafted for this opportunity yet.</p>
        ) : (
          <>
            <p style={{ fontSize: 12, color: colors.muted, margin: '0 0 8px' }}>
              {sent.length} of {filedDrafts.length} message{filedDrafts.length === 1 ? '' : 's'} sent · {responded.length} response{responded.length === 1 ? '' : 's'} received.
            </p>
            <div style={{ display: 'grid', gap: 8 }}>
              {filedDrafts.map((draft) => {
                const status = OUTREACH_STATUS_META[draft.status];
                return (
                  <div
                    key={draft.id}
                    style={{
                      padding: '10px 12px',
                      borderRadius: radii.sm,
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.07)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: 12, textTransform: 'uppercase', color: colors.text }}>{draft.channel}</strong>
                        <span style={{ fontFamily: fonts.mono, fontSize: 11.5, color: draft.recipient ? colors.text : colors.muted, fontStyle: draft.recipient ? 'normal' : 'italic' }}>
                          {draft.recipient ? `→ ${draft.recipient}` : 'no recipient on file'}
                        </span>
                      </div>
                      <span
                        style={{
                          display: 'inline-flex',
                          padding: '2px 7px',
                          borderRadius: radii.sm,
                          fontSize: 10,
                          fontWeight: 700,
                          fontFamily: fonts.mono,
                          color: status.color,
                          background: status.bg,
                          border: `1px solid ${status.color}44`,
                        }}
                      >
                        {status.label.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: colors.muted, marginTop: 4 }}>
                      {draft.status === 'drafted' || draft.status === 'ready' ? 'Drafted' : 'Sent'} {formatRelativeTime(draft.createdAt)}
                      {draft.updatedAt !== draft.createdAt ? ` · updated ${formatRelativeTime(draft.updatedAt)}` : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
