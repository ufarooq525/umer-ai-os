import Link from 'next/link';
import { colors, fonts, spacing } from '@umer/ui';
import type { AttentionCase } from '@/lib/company-derive';
import { TechnicalDetailsDrawer } from './TechnicalDetailsDrawer';
import { formatRelativeTime } from './format';

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: colors.accent,
          fontFamily: fonts.mono,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.6, color: colors.text }}>{children}</div>
    </div>
  );
}

export function AttentionCaseDetail({ attentionCase }: { attentionCase: AttentionCase }) {
  return (
    <div
      style={{
        border: `1px solid ${colors.border}`,
        borderRadius: 14,
        background: colors.surface,
        padding: spacing.lg,
        display: 'grid',
        gap: spacing.md,
      }}
    >
      <div>
        <div style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.muted, marginBottom: 4 }}>
          {formatRelativeTime(attentionCase.occurredAt)}
        </div>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 650 }}>{attentionCase.title}</h2>
      </div>

      <Section label="What happened">{attentionCase.whatHappened}</Section>

      {attentionCase.source.length > 0 ? (
        <Section label="Source">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            {attentionCase.source.map((link, idx) => (
              <span key={`${link.type}:${link.id}`} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {idx > 0 ? <span style={{ color: colors.muted }}>→</span> : null}
                <Link href={link.href} style={{ color: colors.accent, textDecoration: 'none', fontSize: 12 }}>
                  {link.label}
                </Link>
              </span>
            ))}
          </div>
        </Section>
      ) : null}

      {attentionCase.evidence.length > 0 ? (
        <Section label="Evidence">
          <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
            {attentionCase.evidence.map((line) => (
              <li key={line} style={{ color: colors.muted, fontSize: 12 }}>
                {line}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {attentionCase.currentState.length > 0 ? (
        <Section label="Current state">
          <div style={{ display: 'grid', gap: 4 }}>
            {attentionCase.currentState.map((s) => (
              <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, maxWidth: 320 }}>
                <span style={{ color: colors.muted }}>{s.label}</span>
                <strong>{s.value}</strong>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      <Section label="Recommended next action">{attentionCase.recommendedNextAction}</Section>

      <Section label="CEO action">
        {attentionCase.ceoActionNeeded ? 'This needs a decision from you.' : 'No action currently required.'}
      </Section>

      <div>
        <TechnicalDetailsDrawer data={attentionCase.technical} />
      </div>
    </div>
  );
}
