import { loadEnv } from '@umer/config';
import { startRuntime, startHealthServer, healthCheck } from '@umer/kernel';
import { createMessageFabric } from '@umer/message-fabric';
import { createLogger } from '@umer/observability';
import { createOrchestrator, createOrchestrationWorker } from '@umer/orchestration';

const serviceName = 'orchestration-worker';
const log = createLogger(serviceName);
const env = loadEnv();

const fabric = await createMessageFabric({ producer: serviceName });
const orchestrator = createOrchestrator({ fabric, producer: serviceName });
const worker = createOrchestrationWorker({
  orchestrator,
  fabric,
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
