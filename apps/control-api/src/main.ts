import { loadEnv } from '@umer/config';
import { startRuntime } from '@umer/kernel';
import { createLogger } from '@umer/observability';
import {
  bootstrapDemoState,
  createControlApiServer,
  createControlApiState,
} from './server.js';
import { startQaNightlyWatchdogCron } from './qa-nightly-scheduler.js';
import { startAgentRunReadModelSubscription } from './agent-run-subscription.js';

const serviceName = 'control-api';
const log = createLogger(serviceName);

const env = loadEnv();
const state = await createControlApiState();
await bootstrapDemoState(state);
const agentRunSubscription = await startAgentRunReadModelSubscription(state);

const runtime = await startRuntime({
  serviceName,
  onShutdown: async () => {
    await agentRunSubscription?.stop();
  },
});

const server = createControlApiServer(state);

const qaNightly = startQaNightlyWatchdogCron(state, {
  onTick: (result) => {
    log.info(
      {
        projectId: result.projectId,
        tickId: result.tickId,
        intakeId: result.intake.intakeId,
        scheduleId: result.scheduleId,
      },
      'qa nightly watchdog tick completed',
    );
  },
  onError: (err) => {
    log.error(
      { err: err instanceof Error ? err.message : String(err) },
      'qa nightly watchdog tick failed',
    );
  },
});

server.listen(env.CONTROL_API_PORT, () => {
  log.info(
    {
      port: env.CONTROL_API_PORT,
      projects: state.projectRegistry.list().length,
      projectsRoot: state.projectRegistry.getProjectsRoot(),
      qaNightlyWatchdog: {
        enabled: qaNightly.enabled,
        cron: qaNightly.expression,
        projectId: 'school-app',
      },
    },
    'control-api listening',
  );
});

void runtime;
