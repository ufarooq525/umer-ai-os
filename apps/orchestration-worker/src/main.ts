import { loadEnv } from '@umer/config';
import { startRuntime, startHealthServer, healthCheck } from '@umer/kernel';
import { createMessageFabric } from '@umer/message-fabric';
import { createLogger } from '@umer/observability';
import { pingMySql, createMySqlExecutor } from '@umer/db';
import {
  createOrchestrator,
  createOrchestrationWorker,
  InMemoryWorkGraphStore,
  MySqlWorkGraphStore,
  PersistentWorkGraph,
  WorkGraphProjector,
  type WorkGraphStore,
} from '@umer/orchestration';

const serviceName = 'orchestration-worker';
const log = createLogger(serviceName);
const env = loadEnv();

const fabric = await createMessageFabric({ producer: serviceName });
const orchestrator = createOrchestrator({ fabric, producer: serviceName });

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
