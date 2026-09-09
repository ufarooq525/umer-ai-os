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
import {
  createFilesystemListTool,
  createFilesystemReadTool,
  createFilesystemWriteTool,
  createProcessRecommendTool,
  createProcessRunAuditTool,
  createSearchWebTool,
  createToolRegistry,
  createToolRouter,
} from '@umer/extension';

const serviceName = 'agent-worker';
const log = createLogger(serviceName);
const env = loadEnv();

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');
const specialistsDir = join(repoRoot, 'specialists');

// Every registered Specialist mandate this worker can execute Work Packages for.
// eng.app-delivery stays on the deterministic structured-change-set handler
// (its own mandate forbids invented content); every other specialist below runs
// through the generic Model Routing → LLM Provider → Tool Router agent loop.
// ux.design, qa.verify, and security.review are wired to REAL sandboxed
// tools (filesystem_read, filesystem_list, filesystem_write,
// process_recommend, process_run_audit, below) rather than running
// ungrounded — all three can
// only actually inspect (or seal evidence into) a project when
// ReadyWorkPackagePlanner resolved a real targetPath for them (see
// WorkPackageContract.targetPath); otherwise the planner skips the node
// rather than dispatch a specialist with nothing real to read. filesystem_write
// confines each specialist to its own .umer/<slug>/ evidence subtree (derived
// from its specialistId, e.g. ux.design -> .umer/ux/) — it can never touch
// product code. process_recommend never executes anything itself — it only
// classifies a proposed command against a fixed allowlist, matching
// qa.verify's Advise authority class. process_run_audit is the ONE tool in
// this codebase that spawns a real subprocess: its surface is a closed enum
// (npm | composer) mapped in code to a fixed, non-shell argv — the model can
// never supply its own command or arguments, matching security.review's
// Advise authority class and its mandate's explicit ban on anything beyond
// the allowlisted audit CLIs.
const specPaths = [
  join(specialistsDir, 'engineering', 'application-delivery.md'),
  join(specialistsDir, 'growth', 'opportunity-research.md'),
  join(specialistsDir, 'design', 'ux-design.md'),
  join(specialistsDir, 'qa', 'qa-verify.md'),
  join(specialistsDir, 'security', 'security-review.md'),
  join(specialistsDir, 'program', 'requirements-formalize.md'),
  join(specialistsDir, 'program', 'product-definition.md'),
  join(specialistsDir, 'architecture', 'solution-design.md'),
  join(specialistsDir, 'release', 'release-management.md'),
  join(specialistsDir, 'operations', 'site-reliability.md'),
  join(specialistsDir, 'commercial', 'sales-representative.md'),
  join(specialistsDir, 'customer-success', 'account-manager.md'),
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
toolRegistry.register(createFilesystemListTool());
toolRegistry.register(createFilesystemWriteTool());
toolRegistry.register(createProcessRecommendTool());
toolRegistry.register(createProcessRunAuditTool());
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
