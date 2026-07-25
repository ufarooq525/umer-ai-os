import cron, { type ScheduledTask } from 'node-cron';
import type { ControlApiState } from './state.js';
import {
  isQaNightlyWatchdogEnabled,
  resolveQaNightlyCronExpression,
  runQaNightlyWatchdog,
} from './qa-nightly-watchdog.js';

export type QaNightlyWatchdogScheduler = {
  expression: string;
  enabled: boolean;
  stop: () => void;
};

/**
 * Start the school-app nightly QA watchdog cron.
 * Uses the same {@link runQaNightlyWatchdog} entry as the manual trigger.
 */
export function startQaNightlyWatchdogCron(
  state: ControlApiState,
  options?: {
    env?: NodeJS.ProcessEnv;
    onTick?: (result: Awaited<ReturnType<typeof runQaNightlyWatchdog>>) => void;
    onError?: (err: unknown) => void;
  },
): QaNightlyWatchdogScheduler {
  const env = options?.env ?? process.env;
  const expression = resolveQaNightlyCronExpression(env);
  const enabled = isQaNightlyWatchdogEnabled(env);

  if (!enabled) {
    return {
      expression,
      enabled: false,
      stop: () => undefined,
    };
  }

  if (!cron.validate(expression)) {
    throw new Error(`Invalid UMER_QA_WATCHDOG_CRON expression: ${expression}`);
  }

  const task: ScheduledTask = cron.schedule(
    expression,
    async () => {
      try {
        const result = await runQaNightlyWatchdog(state);
        options?.onTick?.(result);
      } catch (err) {
        options?.onError?.(err);
      }
    },
    {
      name: 'qa-nightly-school-app',
      noOverlap: true,
    },
  );

  return {
    expression,
    enabled: true,
    stop: () => {
      void task.stop();
      void task.destroy();
    },
  };
}
