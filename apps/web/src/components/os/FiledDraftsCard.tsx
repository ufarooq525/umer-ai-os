import { Card, colors, fonts, radii } from '@umer/ui';
import type { OutreachDraftRecord } from '@/lib/control-api';
import { draftHasInventedLift } from '@/lib/operator-brief';

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
  return (
    <Card title="Filed drafts (do not send blindly)">
      <p style={{ margin: '0 0 12px', fontSize: 13, color: colors.muted, lineHeight: 1.5 }}>
        These were written by the research run. If a draft invents a percentage, it is marked unusable — use the
        one-page proposal above.
      </p>
      <div style={{ display: 'grid', gap: 10 }}>
        {sorted.map((draft) => {
          const dirty = draftHasInventedLift(draft.body);
          const isWhatsApp = draft.channel === 'whatsapp';
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
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                <strong style={{ fontSize: 13, textTransform: 'uppercase' }}>{draft.channel}</strong>
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
