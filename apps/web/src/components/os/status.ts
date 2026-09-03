import { colors } from '@umer/ui';

export type StatusTone = 'working' | 'thinking' | 'waiting' | 'blocked' | 'completed' | 'paused' | 'failed' | 'idle';

export type StatusMeta = { icon: string; label: string; color: string };

const STATUS_META: Record<StatusTone, StatusMeta> = {
  working: { icon: '\u{1F7E2}', label: 'WORKING', color: colors.success },
  thinking: { icon: '\u{1F7E3}', label: 'THINKING', color: '#b48ce8' },
  waiting: { icon: '\u{1F7E1}', label: 'WAITING', color: colors.warning },
  blocked: { icon: '\u{1F534}', label: 'BLOCKED', color: colors.danger },
  completed: { icon: '✓', label: 'COMPLETED', color: colors.success },
  paused: { icon: '⏸', label: 'PAUSED', color: colors.muted },
  failed: { icon: '✕', label: 'FAILED', color: colors.danger },
  idle: { icon: '⚪', label: 'IDLE', color: colors.muted },
};

export function statusMeta(tone: StatusTone): StatusMeta {
  return STATUS_META[tone];
}

/** Maps an AgentRecord's runtime status + CEO-imposed control state onto one display tone. */
export function agentTone(status: string, controlState: 'active' | 'paused'): StatusTone {
  if (controlState === 'paused') return 'paused';
  if (status === 'active') return 'working';
  if (status === 'blocked') return 'blocked';
  if (status === 'offline') return 'idle';
  return 'idle';
}

/** Maps an AgentRunSnapshot's currentAction onto a display tone (only meaningful while status === 'running'). */
export function runActionTone(status: 'running' | 'completed' | 'failed', currentAction?: string): StatusTone {
  if (status === 'completed') return 'completed';
  if (status === 'failed') return 'failed';
  if (currentAction === 'executing_tool') return 'working';
  if (currentAction === 'waiting_on_model') return 'thinking';
  return 'waiting';
}

export function taskTone(status: string): StatusTone {
  switch (status) {
    case 'Done':
      return 'completed';
    case 'Cancelled':
      return 'failed';
    case 'Blocked':
      return 'blocked';
    case 'InProgress':
    case 'InReview':
      return 'working';
    case 'Assigned':
      return 'waiting';
    default:
      return 'idle';
  }
}

export function projectTone(status: string): StatusTone {
  switch (status) {
    case 'Active':
      return 'working';
    case 'Paused':
      return 'paused';
    case 'Archived':
    case 'Abandoned':
      return 'idle';
    case 'Closing':
      return 'completed';
    default:
      return 'waiting';
  }
}
