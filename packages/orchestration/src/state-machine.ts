import type { WorkPackageStatus } from '@umer/contracts';
import { OrchestrationError } from './errors.js';

/** Legal Work Package transitions — WORK_MANAGEMENT_FRAMEWORK.md §12 */
const TRANSITIONS: Record<WorkPackageStatus, readonly WorkPackageStatus[]> = {
  Draft: ['Queued', 'Cancelled'],
  Queued: ['Dispatched', 'Cancelled', 'Failed'],
  Dispatched: ['Running', 'Failed', 'Cancelled'],
  Running: ['AwaitingReview', 'Failed', 'Cancelled'],
  AwaitingReview: ['Accepted', 'Rejected', 'Cancelled'],
  Accepted: [],
  Rejected: ['Queued', 'Cancelled'],
  Cancelled: [],
  Failed: ['Queued', 'Cancelled'],
};

const TERMINAL: ReadonlySet<WorkPackageStatus> = new Set(['Accepted', 'Cancelled']);

export function canTransition(from: WorkPackageStatus, to: WorkPackageStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: WorkPackageStatus, to: WorkPackageStatus): void {
  if (!canTransition(from, to)) {
    throw new OrchestrationError(
      'INVALID_TRANSITION',
      `Illegal Work Package transition: ${from} → ${to}`,
    );
  }
}

export function isTerminalStatus(status: WorkPackageStatus): boolean {
  return TERMINAL.has(status);
}

export function isActiveStatus(status: WorkPackageStatus): boolean {
  return !isTerminalStatus(status) && status !== 'Failed' && status !== 'Rejected';
}
