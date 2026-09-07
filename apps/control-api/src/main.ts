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
import { connectWorkManagementStores } from './work-management-store-link.js';
import { connectRequirementStore } from './requirement-store-link.js';
import { connectArtifactStore } from './artifact-store-link.js';
import { applyRequirementDecomposition } from '@umer/orchestration';

const serviceName = 'control-api';
const log = createLogger(serviceName);
const env = loadEnv();
const state = await createControlApiState();
await connectGateWaitStore(state);
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
await connectWorkGraphStore(state);

// Canonical M1 bridge: once the real Requirement and Work Graph stores are
// connected, every new project-scoped Requirement creates the initial delivery
// graph exactly once. The Requirements node retains the canonical requirement
// id in contract metadata; downstream nodes remain Planned/Blocked until their
// real specialist work is completed, so this never fabricates progress.
if (state.requirementStore && state.persistentWorkGraph) {
  const originalCreate = state.requirementStore.create.bind(state.requirementStore);
  state.requirementStore.create = async (input) => {
    const requirement = await originalCreate(input);
    if (!requirement.projectId || !state.persistentWorkGraph) return requirement;

    const graph = await state.persistentWorkGraph.load(requirement.projectId);
    const hasRequirementsNode = graph.listNodes(requirement.projectId).some((node) => node.type === 'Requirements');
    if (!hasRequirementsNode) {
      await applyRequirementDecomposition(state.persistentWorkGraph, {
        projectId: requirement.projectId,
        slug: requirement.requirementId,
        requirementId: requirement.requirementId,
      });
    }
    return requirement;
  };
}

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

server.listen(env.CONTROL_API_PORT, () => {
  log.info({ port: env.CONTROL_API_PORT, projects: state.projectRegistry.list().length, projectsRoot: state.projectRegistry.getProjectsRoot(), qaNightlyWatchdog: { enabled: qaNightly.enabled, cron: qaNightly.expression, projectId: 'school-app' } }, 'control-api listening');
});

void runtime;
