import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from '@umer/config';
import { startRuntime, startHealthServer, healthCheck } from '@umer/kernel';
import { createMessageFabric } from '@umer/message-fabric';
import { createLogger } from '@umer/observability';
import {
  createAgentRuntime,
  createAgentWorker,
  createMessageFabricAgentEventPublisher,
} from '@umer/agent-runtime';
import { InMemoryRegistryAdapter, loadSpecFromFile } from '@umer/specialist-sdk';
import { createArtifactStack } from '@umer/artifacts';
import { createLLMProviderFromEnv } from '@umer/model-routing';
import { createFilesystemReadTool, createSearchWebTool, createToolRegistry, createToolRouter } from '@umer/extension';

const serviceName = 'agent-worker';
const log = createLogger(serviceName);
const env = loadEnv();

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');
const specialistsDir = join(repoRoot, 'specialists');

// Every registered Specialist mandate this worker can execute Work Packages for.
// eng.app-delivery stays on the deterministic structured-change-set handler
// (its own mandate forbids invented content); every other specialist below runs
// through the generic Model Routing → LLM Provider → Tool Router agent loop.
// ux.design is the first specialist wired to a REAL sandboxed tool
// (filesystem_read, below) rather than running ungrounded — it can only
// actually inspect a project when ReadyWorkPackagePlanner resolved a real
// targetPath for it (see WorkPackageContract.targetPath); otherwise the
// planner skips the node rather than dispatch a specialist with nothing
// real to read.
const specPaths = [
  join(specialistsDir, 'engineering', 'application-delivery.md'),
  join(specialistsDir, 'growth', 'opportunity-research.md'),
  join(specialistsDir, 'design', 'ux-design.md'),
];

const loadedSpecs = await Promise.all(specPaths.map((path) => loadSpecFromFile(path)));
const registry = new InMemoryRegistryAdapter();
for (const loaded of loadedSpecs) {
  await registry.register(loaded.binding);
}
const mandatesById = new Map(loadedSpecs.map((loaded) => [loaded.binding.specialistId, loaded]));

const toolRegistry = createToolRegistry();
toolRegistry.register(createSearchWebTool());
toolRegistry.register(createFilesystemReadTool());
const toolRouter = createToolRouter({ registry: toolRegistry });
const llmProvider = createLLMProviderFromEnv({ env });

const fabric = await createMessageFabric({ producer: serviceName });
const { engine: artifactEngine } = createArtifactStack();
const worker = createAgentWorker({
  runtime: createAgentRuntime({
    resolveMandate: async (specialistId) => {
      const loaded = mandatesById.get(specialistId);
      return loaded ? { mandate: loaded.mandate, binding: loaded.binding } : undefined;
    },
    events: createMessageFabricAgentEventPublisher(fabric, serviceName),
    llm: {
      provider: llmProvider,
      toolRegistry,
      toolRouter,
      maxIterations: env.AGENT_LOOP_MAX_ITERATIONS,
      runTimeoutMs: env.AGENT_LOOP_TIMEOUT_MS,
      temperature: env.LLM_TEMPERATURE,
      maxTokens: env.LLM_MAX_TOKENS,
    },
  }),
  fabric,
  producer: serviceName,
  artifactEngine,
  resolveAgentDisplay: (specialistId) => {
    const loaded = mandatesById.get(specialistId);
    return loaded
      ? {
          name: loaded.mandate.contract.name,
          department: loaded.mandate.contract.department,
          capabilityIds: loaded.mandate.contract.capabilityIds,
        }
      : undefined;
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
    log.info('agent-worker shutdown');
  },
});

await worker.start();
log.info(
  {
    specialistIds: [...mandatesById.keys()],
    llmProvider: env.LLM_PROVIDER,
    llmModel: env.LLM_MODEL,
    healthPort: health.port,
  },
  'agent-worker consuming cmd.agent.dispatch',
);

await new Promise(() => undefined);
