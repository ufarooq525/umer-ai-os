import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from '@umer/config';
import { startRuntime, startHealthServer, healthCheck } from '@umer/kernel';
import { createMessageFabric } from '@umer/message-fabric';
import { createLogger } from '@umer/observability';
import { pingMySql, createMySqlExecutor } from '@umer/db';
import { loadSpecFromFile } from '@umer/specialist-sdk';
import {
  createOrchestrator,
  createOrchestrationWorker,
  InMemoryWorkGraphStore,
  InMemoryWorkPackageStore,
  MySqlWorkGraphStore,
  MySqlWorkPackageStore,
  PersistentWorkGraph,
  WorkGraphProjector,
  type WorkGraphPlanningOptions,
  type WorkGraphStore,
  type WorkPackageStore,
} from '@umer/orchestration';

const serviceName = 'orchestration-worker';
const log = createLogger(serviceName);
const env = loadEnv();

// Real, currently-dispatchable Specialist metadata for the planning path
// (ReadyWorkPackagePlanner needs a real specVersion/specHash, not a made-up
// one) — read from the SAME spec file apps/agent-worker loads eng.app-delivery
// from, so both processes agree on what's actually current. Only
// 'Implementation' maps to a real Specialist today: eng.app-delivery is the
// only one apps/agent-worker actually registers for dispatch (see its
// main.ts) — every other node type correctly has no mapping, so
// ReadyWorkPackagePlanner skips it (reported, not fabricated) rather than
// building a Work Package no running worker could execute.
const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');
const engAppDelivery = await loadSpecFromFile(
  join(repoRoot, 'specialists', 'engineering', 'application-delivery.md'),
);
const workGraphPlanningResolver: WorkGraphPlanningOptions['resolveSpecialist'] = (node) =>
  node.type === 'Implementation'
    ? {
        specialistId: engAppDelivery.binding.specialistId,
        specialistSpecVersion: engAppDelivery.binding.specVersion,
        specialistSpecHash: engAppDelivery.binding.specHash,
      }
    : undefined;

const fabric = await createMessageFabric({ producer: serviceName });

// Best-effort MySQL Work Package store — the Orchestrator's own
// authoritative record of every Work Package it has ever queued/dispatched/
// run. Without this, a restart loses every in-flight Work Package: attempt
// counts, timeout tracking, and the "Running" status itself all vanish,
// silently orphaning whatever the AgentWorker was actually doing. Same
// fail-open pattern as the Work Graph store below.
let workPackageStore: WorkPackageStore = new InMemoryWorkPackageStore();
try {
  if (await pingMySql()) {
    workPackageStore = new MySqlWorkPackageStore({ db: createMySqlExecutor() });
    log.info('work package store connected to MySQL');
  } else {
    throw new Error('pingMySql returned false');
  }
} catch (err) {
  log.warn(
    { err: err instanceof Error ? err.message : String(err) },
    'work package store unavailable (MySQL unreachable) — Work Packages will not survive a restart until this recovers',
  );
}
const orchestrator = createOrchestrator({ fabric, producer: serviceName, store: workPackageStore });

// Best-effort MySQL Work Graph store — same fail-open pattern as
// control-api's work-graph-link.ts. Both processes must point at the SAME
// store for the projector below to see graph nodes control-api's
// decompose/plan routes created; the in-memory fallback only works for a
// single-process dev setup where nothing decomposed a graph yet.
let workGraphStore: WorkGraphStore = new InMemoryWorkGraphStore();
try {
  if (await pingMySql()) {
    workGraphStore = new MySqlWorkGraphStore({ db: createMySqlExecutor() });
    log.info('work graph store connected to MySQL');
  } else {
    throw new Error('pingMySql returned false');
  }
} catch (err) {
  log.warn(
    { err: err instanceof Error ? err.message : String(err) },
    'work graph store unavailable (MySQL unreachable) — Work Package lifecycle will not project onto any Work Graph until this recovers',
  );
}
const persistentWorkGraph = new PersistentWorkGraph(workGraphStore);
const workGraphProjector = new WorkGraphProjector(persistentWorkGraph, workGraphStore);

const worker = createOrchestrationWorker({
  orchestrator,
  fabric,
  workGraphProjector,
  workGraphPlanning: {
    persistentGraph: persistentWorkGraph,
    resolveSpecialist: workGraphPlanningResolver,
  },
});

const health = await startHealthServer({
  serviceName,
  port: env.HEALTH_PORT,
  getHealth: () => healthCheck(serviceName),
});

await startRuntime({
  serviceName,
  onShutdown: async () => {
    await worker.stop();
    await health.close();
    log.info('orchestration-worker shutdown');
  },
});

await worker.start();
log.info(
  { healthPort: health.port },
  'orchestration-worker consuming cmd.orchestration and agent events',
);

await new Promise(() => undefined);
