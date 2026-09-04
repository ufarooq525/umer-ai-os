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
 * comes straight from CompanyPulse. Active stages get a copper border, not a glow loop.
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
    <div
      style={{
        width: 220,
        flexShrink: 0,
        padding: spacing.md,
        borderRadius: radii.lg,
        border: `1px solid ${stage.active ? colors.accent : colors.border}`,
        background: colors.surface,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div
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
        </div>
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
    </div>
  );
}

function Connector({ active }: { active: boolean }) {
  return (
    <div
      style={{
        width: 36,
        height: 2,
        flexShrink: 0,
        background: active ? colors.accent : colors.border,
        margin: '0 4px',
        borderRadius: 99,
        opacity: active ? 0.7 : 1,
      }}
    />
  );
}
