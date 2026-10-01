import { loadEnv } from '@umer/config';
import { startRuntime } from '@umer/kernel';
import { createLogger } from '@umer/observability';
import { bootstrapDemoState, createControlApiServer, createControlApiState } from './server.js';
import { startQaNightlyWatchdogCron } from './qa-nightly-scheduler.js';
import { startAgentRunReadModelSubscription } from './agent-run-subscription.js';
import { connectOpportunityReader } from './opportunity-link.js';
import { connectRuntimeWorkPackageBridge } from './runtime-work-package-bridge.js';
import { connectWorkGraphStore } from './work-graph-link.js';
import { connectGateWaitStore } from './gate-store-link.js';
import { connectSpecialistControlStore } from './specialist-control-link.js';
import { connectWorkManagementStores } from './work-management-store-link.js';
import { connectRequirementStore } from './requirement-store-link.js';
import { connectArtifactStore } from './artifact-store-link.js';
import { connectRequirementWorkGraphBridge } from './requirement-workgraph-bridge.js';
import { connectCommercialPipeline } from './commercial-link.js';
import { connectCustomerSuccessStore } from './customer-success-link.js';

const serviceName = 'control-api';
const log = createLogger(serviceName);
const env = loadEnv();

// Log security configuration at startup
const bindHost = process.env.CONTROL_API_BIND_HOST ?? '127.0.0.1';
const corsOrigins = process.env.CONTROL_API_CORS_ORIGINS ?? 'http://localhost:3001,http://127.0.0.1:3001';
const hasToken = Boolean(process.env.CONTROL_API_TOKEN?.trim());

const state = await createControlApiState();
await connectGateWaitStore(state);
await connectSpecialistControlStore(state);
await connectWorkManagementStores(state);
await connectRequirementStore(state);
await connectArtifactStore(state);

if (process.env.CONTROL_API_SEED_DEMO === 'true') {
  await bootstrapDemoState(state);
  log.warn('CONTROL_API_SEED_DEMO=true — seeded fabricated demo Work Package/Gate. Do not use in production.');
}

const agentRunSubscription = await startAgentRunReadModelSubscription(state);
const runtimeWorkPackageBridge = await connectRuntimeWorkPackageBridge(state);
await connectOpportunityReader(state);
await connectCommercialPipeline(state);
await connectCustomerSuccessStore(state);
await connectWorkGraphStore(state);

connectRequirementWorkGraphBridge(state);

const runtime = await startRuntime({
  serviceName,
  onShutdown: async () => {
    await agentRunSubscription?.stop();
    await runtimeWorkPackageBridge?.stop();
  },
});

const server = createControlApiServer(state);
const qaNightly = startQaNightlyWatchdogCron(state, {
  onTick: (result) => log.info({ projectId: result.projectId, tickId: result.tickId, intakeId: result.intake.intakeId, scheduleId: result.scheduleId }, 'qa nightly watchdog tick completed'),
  onError: (err) => log.error({ err: err instanceof Error ? err.message : String(err) }, 'qa nightly watchdog tick failed'),
});

server.listen(env.CONTROL_API_PORT, bindHost, () => {
  log.info({ 
    host: bindHost,
    port: env.CONTROL_API_PORT, 
    projects: state.projectRegistry.list().length, 
    projectsRoot: state.projectRegistry.getProjectsRoot(), 
    qaNightlyWatchdog: { enabled: qaNightly.enabled, cron: qaNightly.expression, projectId: 'school-app' },
    corsOrigins,
    tokenAuth: hasToken
  }, 'control-api listening');
  if (!hasToken) {
    log.warn('CONTROL_API_TOKEN not set — accepting requests from localhost without authentication. Set CONTROL_API_TOKEN in production.');
  }
});

void runtime;
