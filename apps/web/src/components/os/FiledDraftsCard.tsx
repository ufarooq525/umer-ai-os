import { Card, colors, fonts, radii } from '@umer/ui';
import type { OutreachDraftRecord } from '@/lib/control-api';
import { draftHasInventedLift } from '@/lib/operator-brief';

export function FiledDraftsCard({ drafts }: { drafts: OutreachDraftRecord[] }) {
  if (drafts.length === 0) return null;
  return (
    <Card title="Filed drafts (do not send blindly)">
      <p style={{ margin: '0 0 12px', fontSize: 13, color: colors.muted, lineHeight: 1.5 }}>
        These were written by the research run. If a draft invents a percentage, it is marked unusable — use the
        one-page proposal above.
      </p>
      <div style={{ display: 'grid', gap: 10 }}>
        {drafts.map((draft) => {
          const dirty = draftHasInventedLift(draft.body);
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
