import { colors, fonts, radii } from '@umer/ui';
import { statusMeta, type StatusTone } from './status';

export function StatusBadge({ tone, label }: { tone: StatusTone; label?: string }) {
  const meta = statusMeta(tone);

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 9px',
        borderRadius: radii.sm,
        border: `1px solid ${colors.border}`,
        background: colors.surfaceRaised,
        fontFamily: fonts.mono,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.04em',
        color: meta.color,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: meta.color,
          flexShrink: 0,
        }}
      />
      {label ?? meta.label}
    </span>
  );
}

