import Link from 'next/link';
import { colors, fonts, radii, spacing } from '@umer/ui';
import type { AgentRecord, AgentRunRecord } from '@/lib/control-api';
import { StatusBadge } from './StatusBadge';
import { agentTone, runActionTone } from './status';
import { formatRelativeTime, humanizeSpecialistId } from './format';

export type AgentCardProps = {
  agent: AgentRecord;
  run?: AgentRunRecord;
  currentTaskTitle?: string;
  projectName?: string;
  compact?: boolean;
};

export function AgentCard({ agent, run, currentTaskTitle, projectName, compact }: AgentCardProps) {
  const tone = run && run.status === 'running' ? runActionTone(run.status, run.currentAction) : agentTone(agent.status, agent.controlState);
  const now =
    run?.status === 'running' && run.currentTool
      ? `Using tool "${run.currentTool}"`
      : run?.status === 'running'
        ? 'Waiting on the model'
        : currentTaskTitle
          ? currentTaskTitle
          : agent.controlState === 'paused'
            ? agent.controlReason
              ? `Paused — ${agent.controlReason}`
              : 'Paused by CEO'
            : 'No active work';

  const problem = run && run.failures.length > 0 ? run.failures[run.failures.length - 1]!.message : 'None';

  return (
    <Link
      href={`/company/agents/${agent.agentId}`}
      style={{
        display: 'block',
        padding: spacing.md,
        borderRadius: radii.lg,
        border: `1px solid ${colors.border}`,
        background: colors.surface,
        textDecoration: 'none',
        color: colors.text,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <strong style={{ fontSize: 15 }}>{agent.name ?? agent.agentId}</strong>
          <div style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>
            {agent.department ?? humanizeSpecialistId(agent.specialistId)}
          </div>
        </div>
        <StatusBadge tone={tone} />
      </div>

      {!compact ? (
        <div style={{ marginTop: spacing.sm, display: 'grid', gap: 6 }}>
          {projectName ? (
            <NarrativeLine label="WHY" text={`Working within "${projectName}"`} />
          ) : null}
          <NarrativeLine label="NOW" text={now} />
          {run?.summary ? <NarrativeLine label="RESULT" text={run.summary} /> : null}
          <NarrativeLine label="PROBLEM" text={problem} tone={problem !== 'None' ? colors.danger : undefined} />
        </div>
      ) : null}

      <div
        style={{
          marginTop: spacing.sm,
          paddingTop: spacing.sm,
          borderTop: `1px solid ${colors.border}`,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          fontFamily: fonts.mono,
          fontSize: 11,
          color: colors.muted,
        }}
      >
        {run ? <span>{run.toolCalls.length} tool calls</span> : null}
        {run && run.failures.length > 0 ? <span style={{ color: colors.danger }}>{run.failures.length} failures</span> : null}
        <span>seen {formatRelativeTime(agent.lastSeenAt)}</span>
      </div>
    </Link>
  );
}

function NarrativeLine({ label, text, tone }: { label: string; text: string; tone?: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, fontSize: 12, lineHeight: 1.4 }}>
      <span style={{ fontFamily: fonts.mono, color: colors.accent, fontSize: 10, fontWeight: 700, flexShrink: 0, paddingTop: 2 }}>
        {label}
      </span>
      <span style={{ color: tone ?? colors.text }}>{text}</span>
    </div>
  );
}
