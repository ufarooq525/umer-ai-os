import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from '@umer/config';
import { startRuntime, startHealthServer, healthCheck } from '@umer/kernel';
import { createMessageFabric } from '@umer/message-fabric';
import { createLogger } from '@umer/observability';
import { createAgentRuntime, createAgentWorker } from '@umer/agent-runtime';
import { InMemoryRegistryAdapter, loadSpecFromFile } from '@umer/specialist-sdk';
import { createArtifactStack } from '@umer/artifacts';

const serviceName = 'agent-worker';
const log = createLogger(serviceName);
const env = loadEnv();

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');
const specPath = join(repoRoot, 'specialists', 'engineering', 'application-delivery.md');
const loaded = await loadSpecFromFile(specPath);
const registry = new InMemoryRegistryAdapter();
await registry.register(loaded.binding);

const fabric = await createMessageFabric({ producer: serviceName });
const { engine: artifactEngine } = createArtifactStack();
const worker = createAgentWorker({
  runtime: createAgentRuntime({
    resolveMandate: async (specialistId) =>
      specialistId === loaded.binding.specialistId
        ? { mandate: loaded.mandate, binding: loaded.binding }
        : undefined,
  }),
  fabric,
  producer: serviceName,
  artifactEngine,
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
    log.info('agent-worker shutdown');
  },
});

await worker.start();
log.info(
  { specialistId: loaded.binding.specialistId, healthPort: health.port },
  'agent-worker consuming cmd.agent.dispatch',
);

await new Promise(() => undefined);
