import Link from 'next/link';
import { colors, fonts, spacing } from '@umer/ui';
import type { AttentionCase } from '@/lib/company-derive';
import { TechnicalDetailsDrawer } from './TechnicalDetailsDrawer';
import { formatRelativeTime } from './format';
import { ArrowUpRight } from 'lucide-react';

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.08em',
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
  // Determine consequence summary based on category
  let afterActionNote = 'Autonomous agents will immediately resume unblocked execution and update state.';
  if (attentionCase.category === 'decision_required') {
    afterActionNote = 'Approved opportunity or decision will trigger automated project creation and specialist decomposition.';
  } else if (attentionCase.category === 'repeated_failure') {
    afterActionNote = 'The specialist will be reset or reassigned, clearing failed error loops.';
  } else if (attentionCase.category === 'waiting_too_long') {
    afterActionNote = 'The blocking dependency will be cleared or escalated, allowing work graph progress.';
  }

  const primaryActionHref =
    attentionCase.category === 'decision_required'
      ? '/decisions'
      : attentionCase.source[0]?.href ?? '/activity';


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
        <div style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.muted, marginBottom: 4 }}>
          Reported {formatRelativeTime(attentionCase.occurredAt)}
        </div>
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em', color: colors.text }}>
          {attentionCase.title}
        </h2>
      </div>

      {/* 1. What Happened? */}
      <Section label="1. What happened?">{attentionCase.whatHappened}</Section>

      {/* 2. Why Does It Matter? */}
      <Section label="2. Why does it matter?">
        <div style={{ color: attentionCase.severity === 'critical' ? colors.danger : colors.warning }}>
          {attentionCase.severityReason || 'Requires executive attention to maintain autonomous delivery velocity.'}
        </div>
      </Section>

      {/* 3. Who / What Is Affected? */}
      <Section label="3. Who or what is affected?">
        {attentionCase.source.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 6 }}>
            {attentionCase.source.map((link, idx) => (
              <span key={`${link.type}:${link.id}`} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {idx > 0 ? <span style={{ color: colors.muted }}>→</span> : null}
                <Link
                  href={link.href}
                  style={{
                    color: colors.accent,
                    textDecoration: 'none',
                    fontSize: 12,
                    fontWeight: 600,
                    background: colors.accentSoft,
                    padding: '2px 8px',
                    borderRadius: 4,
                  }}
                >
                  {link.label}
                </Link>
              </span>
            ))}
          </div>
        ) : null}

        {attentionCase.currentState.length > 0 ? (
          <div style={{ display: 'grid', gap: 4, marginTop: 6 }}>
            {attentionCase.currentState.map((s) => (
              <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, maxWidth: 360 }}>
                <span style={{ color: colors.muted }}>{s.label}:</span>
                <span style={{ fontFamily: fonts.mono, fontWeight: 600 }}>{s.value}</span>
              </div>
            ))}
          </div>
        ) : null}
      </Section>

      {/* 4. What Evidence Exists? */}
      {attentionCase.evidence.length > 0 && (
        <Section label="4. What evidence exists?">
          <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
            {attentionCase.evidence.map((line) => (
              <li key={line} style={{ color: colors.muted, fontSize: 12 }}>
                {line}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* 5. What Do I Need To Do? */}
      <Section label="5. What do I need to do?">
        <div style={{ fontWeight: 600, color: colors.text }}>{attentionCase.recommendedNextAction}</div>
        <div style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
          {attentionCase.ceoActionNeeded ? 'Decision is currently blocked waiting on CEO input.' : 'Monitored autonomously.'}
        </div>
      </Section>

      {/* 6. What Happens After I Act? */}
      <Section label="6. What happens after I act?">
        <div style={{ fontSize: 12, color: colors.muted }}>{afterActionNote}</div>
      </Section>

      {/* Direct Action Buttons */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          paddingTop: 12,
          borderTop: `1px solid ${colors.border}`,
        }}
      >
        <Link
          href={primaryActionHref}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            fontWeight: 650,
            color: '#0d0f14',
            background: colors.accent,
            textDecoration: 'none',
            padding: '8px 16px',
            borderRadius: 6,
            transition: 'opacity 0.15s ease',
          }}
        >
          <span>Take Action Now</span>
          <ArrowUpRight size={14} />
        </Link>

        {attentionCase.source[0]?.href && attentionCase.source[0].href !== primaryActionHref && (
          <Link
            href={attentionCase.source[0].href}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              fontWeight: 600,
              color: colors.text,
              background: 'rgba(255, 255, 255, 0.05)',
              border: `1px solid ${colors.border}`,
              textDecoration: 'none',
              padding: '8px 14px',
              borderRadius: 6,
            }}
          >
            <span>Inspect Source</span>
            <ArrowUpRight size={13} />
          </Link>
        )}
      </div>

      <div style={{ marginTop: 4 }}>
        <TechnicalDetailsDrawer data={attentionCase.technical} />
      </div>
    </div>
  );
}

