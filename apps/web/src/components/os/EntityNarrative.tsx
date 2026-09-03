import type { ReactNode } from 'react';
import { Card, colors, fonts, spacing } from '@umer/ui';

export type NarrativeField = { key: 'WHY' | 'GOAL' | 'NOW' | 'NEXT' | 'RESULT' | 'PROBLEM'; value: ReactNode };

/**
 * Shared WHY/GOAL/NOW/NEXT/RESULT/PROBLEM block — the one mental model the
 * product spec asks to keep visually consistent across Company, Opportunity,
 * Project, Agent and Task. Fields with no real data are simply omitted by
 * the caller rather than rendered as empty placeholders.
 */
export function EntityNarrative({ fields }: { fields: NarrativeField[] }) {
  if (fields.length === 0) return null;
  return (
    <Card>
      <div style={{ display: 'grid', gap: spacing.md }}>
        {fields.map((field) => (
          <div key={field.key}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.14em',
                color: colors.accent,
                fontFamily: fonts.mono,
                marginBottom: 4,
              }}
            >
              {field.key}
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.5, color: colors.text }}>{field.value}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
