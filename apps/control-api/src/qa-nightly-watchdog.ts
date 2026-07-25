import type { ControlApiState, IntakeRecord } from './state.js';
import { publishQaViaBus } from './state.js';

/** Pilot project only — no multi-project loop yet. */
export const QA_NIGHTLY_WATCHDOG_PROJECT_ID = 'school-app';

export const QA_NIGHTLY_WATCHDOG_ID = 'qa.watchdog';
export const QA_NIGHTLY_SCHEDULE_ID = 'sched-qa-nightly-school-app';

/** Default 02:00 every day. Override with UMER_QA_WATCHDOG_CRON (node-cron 5-field). */
export const QA_NIGHTLY_WATCHDOG_CRON_DEFAULT = '0 2 * * *';

export type QaNightlyWatchdogResult = {
  projectId: string;
  intake: IntakeRecord;
  tickId: string;
  scheduleId: string;
};

export function resolveQaNightlyCronExpression(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const raw = env.UMER_QA_WATCHDOG_CRON?.trim();
  return raw && raw.length > 0 ? raw : QA_NIGHTLY_WATCHDOG_CRON_DEFAULT;
}

export function isQaNightlyWatchdogEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = env.UMER_QA_WATCHDOG_ENABLED?.trim().toLowerCase();
  if (raw === '0' || raw === 'false' || raw === 'off') return false;
  return true;
}

/**
 * Shared nightly QA watchdog tick — called by cron and by the manual trigger.
 * Hardcoded to school-app for the pilot.
 */
export async function runQaNightlyWatchdog(
  state: ControlApiState,
  options?: { tickId?: string; now?: Date },
): Promise<QaNightlyWatchdogResult> {
  const now = options?.now ?? new Date();
  const tickId =
    options?.tickId?.trim() ||
    `tick-${now.toISOString().replace(/[:.]/g, '-').replace(/Z$/, 'Z')}`;

  const intake = await publishQaViaBus(state, {
    projectId: QA_NIGHTLY_WATCHDOG_PROJECT_ID,
    goal: 'Nightly functional + NFR sweep',
    doneWhen: 'P0 items evidenced',
    source: {
      kind: 'watchdog',
      watchdogId: QA_NIGHTLY_WATCHDOG_ID,
      cadence: 'nightly',
      scheduleId: QA_NIGHTLY_SCHEDULE_ID,
      tickId,
    },
  });

  return {
    projectId: QA_NIGHTLY_WATCHDOG_PROJECT_ID,
    intake,
    tickId,
    scheduleId: QA_NIGHTLY_SCHEDULE_ID,
  };
}
