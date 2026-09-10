import { Card, colors, fonts, radii } from '@umer/ui';
import type { OutreachDraftRecord } from '@/lib/control-api';
import { draftHasInventedLift } from '@/lib/operator-brief';
import { formatRelativeTime } from './format';

export const OUTREACH_STATUS_META: Record<OutreachDraftRecord['status'], { label: string; color: string; bg: string }> = {
  drafted: { label: 'Drafted — not sent', color: colors.muted, bg: 'rgba(255, 255, 255, 0.05)' },
  ready: { label: 'Ready to send', color: colors.warning, bg: 'rgba(245, 158, 11, 0.1)' },
  sent: { label: 'Sent — awaiting response', color: colors.accent, bg: 'rgba(232, 160, 84, 0.12)' },
  replied: { label: 'Replied', color: colors.success, bg: 'rgba(93, 206, 160, 0.12)' },
  converted: { label: 'Converted', color: colors.success, bg: 'rgba(93, 206, 160, 0.15)' },
  rejected: { label: 'Rejected / no response', color: colors.danger, bg: 'rgba(240, 113, 120, 0.12)' },
};

// Phone is the safe first touch: a warm call, then (if it lands) a WhatsApp
// message referencing it, is low-risk. An unsolicited WhatsApp message to a
// stranger is exactly the pattern Meta's spam detection flags -- it can get
// the sending number blocked, with no warning. So WhatsApp is sorted last
// and gets an explicit caution; it is never a co-equal channel to reach for
// first just because a draft exists for it.
const CHANNEL_ORDER: Record<OutreachDraftRecord['channel'], number> = {
  phone: 0,
  email: 1,
  linkedin: 2,
  whatsapp: 3,
};

export function FiledDraftsCard({ drafts }: { drafts: OutreachDraftRecord[] }) {
  if (drafts.length === 0) return null;
  const sorted = [...drafts].sort((a, b) => CHANNEL_ORDER[a.channel] - CHANNEL_ORDER[b.channel]);
  const outcome = sorted.filter((d) => d.status === 'replied' || d.status === 'converted').length;
  const sent = sorted.filter((d) => d.status !== 'drafted' && d.status !== 'ready').length;
  return (
    <Card title="Outreach & response">
      <p style={{ margin: '0 0 12px', fontSize: 13, color: colors.muted, lineHeight: 1.5 }}>
        {sent > 0
          ? `${sent} of ${sorted.length} drafted message${sorted.length === 1 ? '' : 's'} sent · ${outcome} response${outcome === 1 ? '' : 's'} received.`
          : 'Written by the research run — none of these have been sent yet.'}
        {' '}If a draft invents a percentage, it is marked unusable — use the one-page proposal above.
      </p>
      <div style={{ display: 'grid', gap: 10 }}>
        {sorted.map((draft) => {
          const dirty = draftHasInventedLift(draft.body);
          const isWhatsApp = draft.channel === 'whatsapp';
          const status = OUTREACH_STATUS_META[draft.status];
          const responded = draft.updatedAt !== draft.createdAt;
          return (
            <div
              key={draft.id}
              style={{
                padding: 12,
                borderRadius: radii.md,
                border: `1px solid ${dirty ? colors.danger : colors.border}`,
                background: colors.bg,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: 13, textTransform: 'uppercase' }}>{draft.channel}</strong>
                  {draft.recipient ? (
                    <span style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.text }}>→ {draft.recipient}</span>
                  ) : (
                    <span style={{ fontSize: 12, color: colors.muted, fontStyle: 'italic' }}>no recipient on file</span>
                  )}
                </div>
                <span
                  style={{
                    fontFamily: fonts.mono,
                    fontSize: 11,
                    fontWeight: 700,
                    color: dirty ? colors.danger : colors.success,
                  }}
                >
                  {dirty ? 'UNUSABLE — invented lift' : 'CLEAN'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '2px 8px',
                    borderRadius: radii.sm,
                    fontSize: 10.5,
                    fontWeight: 700,
                    fontFamily: fonts.mono,
                    letterSpacing: '0.03em',
                    color: status.color,
                    background: status.bg,
                    border: `1px solid ${status.color}44`,
                  }}
                >
                  {status.label.toUpperCase()}
                </span>
                <span style={{ fontSize: 11, color: colors.muted }}>
                  {draft.status === 'drafted' || draft.status === 'ready' ? 'Drafted' : 'Sent'} {formatRelativeTime(draft.createdAt)}
                  {responded ? ` · updated ${formatRelativeTime(draft.updatedAt)}` : ''}
                </span>
              </div>
              {isWhatsApp ? (
                <p style={{ margin: '0 0 8px', fontSize: 12, color: colors.warning, lineHeight: 1.5 }}>
                  ⚠ Fallback only — use this after a call attempt, not instead of one. An unsolicited WhatsApp
                  message to a stranger risks getting your number blocked. Personalize it, send one at a time from a
                  secondary number, and never queue it to many contacts back to back.
                </p>
              ) : null}
              {draft.subject ? <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{draft.subject}</div> : null}
              <pre
                style={{
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  fontFamily: fonts.sans,
                  fontSize: 12,
                  lineHeight: 1.5,
                  color: dirty ? colors.muted : colors.text,
                  maxHeight: 160,
                  overflow: 'auto',
                }}
              >
                {draft.body}
              </pre>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
