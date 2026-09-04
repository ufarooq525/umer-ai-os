import Link from 'next/link';
import { colors, fonts, radii } from '@umer/ui';
import type { RuntimeTruth } from '@/lib/runtime-truth';
import { StatusBadge } from './StatusBadge';
import { PulseDot } from './PulseDot';

export function RuntimeTruthStrip({ truth }: { truth: RuntimeTruth }) {
  const broken = truth.controlApi.status === 'down' || truth.llm.status === 'down';
  return (
    <Link href="/system-health" style={{ textDecoration: 'none', color: colors.text, display: 'block' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'center',
          padding: '10px 14px',
          borderRadius: radii.md,
          border: `1px solid ${broken ? colors.danger : colors.border}`,
          background: colors.surface,
        }}
      >
        <PulseDot tone={broken ? 'danger' : 'live'} size={8} />
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.muted }}>
          Runtime
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <StatusBadge tone={truth.controlApi.status === 'up' ? 'working' : 'failed'} label="API" />
          <span style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.muted }}>{truth.controlApi.label}</span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <StatusBadge tone={truth.llm.status === 'up' ? 'working' : 'failed'} label="MODEL" />
          <span style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.muted }}>
            {truth.llm.model ? `${truth.llm.model} · ` : ''}
            {truth.llm.label}
          </span>
        </span>
      </div>
    </Link>
  );
}
