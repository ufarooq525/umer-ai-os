'use client';

import { motion } from 'framer-motion';
import { Card, colors, fonts, radii, spacing } from '@umer/ui';
import type { CompanyPulse } from '@/lib/company-derive';

type Stage = {
  n: number;
  title: string;
  metric: string;
  description: string;
  active: boolean;
};

/**
 * A real operating loop, not a literal onboarding sequence — every metric
 * and every pulse comes straight from CompanyPulse (already fetched on the
 * Command Center). A stage only glows/pulses when its own real count is
 * nonzero; nothing here animates without a real signal behind it.
 */
export function CompanyOperatingFlow({ pulse }: { pulse: CompanyPulse }) {
  const stages: Stage[] = [
    {
      n: 1,
      title: 'Opportunities discovered',
      metric: `${pulse.opportunities.total} found`,
      description: 'Market research surfaces real businesses and problems worth solving.',
      active: pulse.opportunities.total > 0,
    },
    {
      n: 2,
      title: 'CEO decides',
      metric: `${pulse.decisionsRequired} awaiting you`,
      description: 'You select or reject each opportunity in the Decision Center.',
      active: pulse.decisionsRequired > 0,
    },
    {
      n: 3,
      title: 'Project created',
      metric: `${pulse.projects.active} active`,
      description: 'A selected opportunity becomes a real project with real tasks.',
      active: pulse.projects.active > 0,
    },
    {
      n: 4,
      title: 'Agents execute',
      metric: `${pulse.agents.working} working`,
      description: 'The workforce picks up tasks and produces real evidence and outputs.',
      active: pulse.agents.working > 0,
    },
  ];

  return (
    <Card title="How the Company Operates">
      <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, minWidth: 'max-content' }}>
          {stages.map((stage, idx) => (
            <div key={stage.n} style={{ display: 'flex', alignItems: 'center' }}>
              <StageCard stage={stage} />
              {idx < stages.length - 1 ? <Connector active={stage.active && stages[idx + 1]!.active} /> : null}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function StageCard({ stage }: { stage: Stage }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: stage.n * 0.06 }}
      style={{
        width: 220,
        flexShrink: 0,
        padding: spacing.md,
        borderRadius: radii.lg,
        border: `1px solid ${stage.active ? colors.accent : colors.border}`,
        background: colors.surface,
        boxShadow: stage.active ? `0 0 0 1px ${colors.accent}33` : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <motion.div
          animate={stage.active ? { scale: [1, 1.1, 1] } : {}}
          transition={stage.active ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } : {}}
          style={{
            width: 24,
            height: 24,
            borderRadius: 999,
            display: 'grid',
            placeItems: 'center',
            background: stage.active ? colors.accentSoft : colors.surfaceRaised,
            border: `1px solid ${stage.active ? colors.accent : colors.borderStrong}`,
            fontSize: 11,
            fontWeight: 700,
            color: stage.active ? colors.accent : colors.muted,
            flexShrink: 0,
          }}
        >
          {stage.n}
        </motion.div>
        <strong style={{ fontSize: 13, color: stage.active ? colors.text : colors.muted }}>{stage.title}</strong>
      </div>
      <div
        style={{
          fontFamily: fonts.mono,
          fontSize: 12,
          color: stage.active ? colors.accent : colors.muted,
          marginBottom: 6,
        }}
      >
        {stage.metric}
      </div>
      <p style={{ margin: 0, fontSize: 11, color: colors.muted, lineHeight: 1.5 }}>{stage.description}</p>
    </motion.div>
  );
}

function Connector({ active }: { active: boolean }) {
  return (
    <div style={{ position: 'relative', width: 32, height: 2, flexShrink: 0, background: colors.border, margin: '0 4px' }}>
      {active ? (
        <motion.div
          animate={{ left: [0, 26] }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          style={{ position: 'absolute', top: -2, width: 6, height: 6, borderRadius: 999, background: colors.accent }}
        />
      ) : null}
    </div>
  );
}
