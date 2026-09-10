import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  parseContract,
  SCHEMA_VERSION,
  WorkPackageContractSchema,
} from '@umer/contracts';
import { loadSpecFromFile, InMemoryRegistryAdapter } from '@umer/specialist-sdk';
import { createArtifactStack } from '@umer/artifacts';
import {
  createMessageFabric,
  closeMessageFabric,
  STREAMS,
  SUBJECTS,
  createCommandEnvelope,
  DeliverPolicy,
  type MessageFabricClient,
} from '@umer/message-fabric';
import { createToolRegistry, createToolRouter } from '../../packages/extension/src/index.js';
import { createLLMProviderFromEnv } from '../../packages/model-routing/src/index.js';
import {
  createAgentRuntime,
  createAgentWorker,
  createMessageFabricAgentEventPublisher,
  subscribeAgentRunReadModel,
} from '@umer/agent-runtime';
import { InMemoryAgentRunReadModelStore } from '../../packages/observability/src/index.js';

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

/**
 * Live proof of the Architecture design pipeline, using the SAME runtime as
 * every other specialist (no second Architecture framework):
 *
 *   Accepted Requirement + Product Brief -> Architecture Work Graph node ->
 *   real NATS dispatch -> real Agent Worker -> Agent Runtime's generic LLM
 *   loop (architecture.design is NOT in DETERMINISTIC_SPECIALISTS — see
 *   packages/agent-runtime/src/runtime.ts) -> real Qwen 3 8B completion ->
 *   sealed ArchitectureDesign artifact (packages/agent-runtime/src/handlers/
 *   llm-agent.ts's inferArtifactType maps department 'Architecture' ->
 *   'ArchitectureDesign') -> real Agent Run in the read model.
 *
 * This is the same dispatch mechanism already proven live for QA
 * (tests/e2e/live-qa-smoke.test.ts) — this test proves architecture.design's
 * OWN mandate loads and activates against the real runtime and produces the
 * correct artifact type, not a second proof that the generic LLM loop itself
 * works.
 */
describe('Live Architecture Smoke Test (NATS + Agent Worker + Live Qwen 3 8B -> ArchitectureDesign)', () => {
  let isNatsAlive = false;
  let isLlmAlive = false;
  // createMessageFabric() is a process-wide singleton (see
  // packages/message-fabric/src/connection.ts): the FIRST call in this file
  // wins and every later call just returns that same cached client, silently
  // ignoring its own options — including `ensureInfrastructure`. So this
  // beforeAll call must BE the real fabric (letting it actually ensure
  // JetStream infrastructure), not a throwaway `ensureInfrastructure: false`
  // health check followed by a second call that assumes it can still create
  // streams.
  let fabric: MessageFabricClient | undefined;

  beforeAll(async () => {
    try {
      fabric = await createMessageFabric({ servers: 'nats://localhost:4222', producer: 'architecture-smoke-test-fabric' });
      isNatsAlive = true;
    } catch {
      isNatsAlive = false;
    }
    try {
      const res = await fetch('http://127.0.0.1:1234/v1/models', { signal: AbortSignal.timeout(3000) });
      isLlmAlive = res.ok;
    } catch {
      isLlmAlive = false;
    }
  });

  afterAll(async () => {
    await closeMessageFabric();
  });

  it(
    'executes live Architecture design: Architecture Work Package -> NATS dispatch -> Agent Worker -> Live Qwen 3 8B LLM -> sealed ArchitectureDesign Artifact',
    async () => {
      if (!isNatsAlive || !isLlmAlive || !fabric) {
        console.warn('Skipping live Architecture test: NATS or LM Studio not responsive');
        return;
      }

      const specPath = join(repoRoot, 'specialists', 'architecture', 'solution-design.md');
      const loadedSpec = await loadSpecFromFile(specPath);

      const registry = new InMemoryRegistryAdapter();
      await registry.register(loadedSpec.binding);

      const { engine: artifactEngine, store: artifactStore } = createArtifactStack();
      const runStore = new InMemoryAgentRunReadModelStore();
      const runSubDurable = `architecture-smoke-run-sub-${Date.now()}`;
      const sub = await subscribeAgentRunReadModel(fabric, runStore, {
        durable: runSubDurable,
      });

      const llmProvider = createLLMProviderFromEnv({
        env: {
          LLM_PROVIDER: 'lmstudio',
          LLM_BASE_URL: 'http://127.0.0.1:1234/v1',
          LLM_MODEL: 'qwen/qwen3-8b',
          LLM_REQUEST_TIMEOUT_MS: 120000,
          LLM_TEMPERATURE: 0.2,
          LLM_MAX_TOKENS: 2048,
          AGENT_LOOP_MAX_ITERATIONS: 5,
          AGENT_LOOP_TIMEOUT_MS: 150000,
        } as any,
      });

      const toolRegistry = createToolRegistry();
      const toolRouter = createToolRouter({ registry: toolRegistry });
      const workerServiceName = `architecture-smoke-worker-${Date.now()}`;
      const agentWorker = createAgentWorker({
        runtime: createAgentRuntime({
          resolveMandate: async (id) =>
            id === loadedSpec.binding.specialistId ? { mandate: loadedSpec.mandate, binding: loadedSpec.binding } : undefined,
          events: createMessageFabricAgentEventPublisher(fabric, workerServiceName),
          llm: {
            provider: llmProvider,
            toolRegistry,
            toolRouter,
            maxIterations: 4,
            runTimeoutMs: 150000,
            temperature: 0.2,
            maxTokens: 2048,
          },
        }),
        fabric,
        producer: workerServiceName,
        durablePrefix: workerServiceName,
        artifactEngine,
        resolveAgentDisplay: () => ({
          name: 'Architecture Design Specialist',
          department: 'Architecture',
          capabilityIds: ['cap.architecture.solution_design'],
        }),
        deliverPolicy: DeliverPolicy.New,
      });

      await agentWorker.start();

      const correlationId = `corr-architecture-smoke-${Date.now()}`;
      const workPackageId = `wp-architecture-smoke-${Date.now()}`;
      const instruction =
        'Design the system architecture for an Accepted Requirement and Product Brief: a client onboarding portal with document upload (PDF/JPEG up to 10MB), status tracking, and admin review, integrating with an existing customer database. Produce a data model, API/integration contract outline, security architecture notes, and deployment topology grounded strictly in this input — do not invent technical scope it does not support.';

      const workPackage = parseContract(WorkPackageContractSchema, {
        id: `pkg-${workPackageId}`,
        schemaVersion: SCHEMA_VERSION,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {
          labels: { environment: 'smoke' },
          annotations: {
            instruction,
            projectId: 'proj-smoke-onboarding',
          },
        },
        kind: 'work_package',
        workPackageId,
        execId: 'EXEC-912',
        stage: 'Architecture',
        status: 'Dispatched',
        specialistId: loadedSpec.binding.specialistId,
        specialistSpecVersion: loadedSpec.binding.specVersion,
        specialistSpecHash: loadedSpec.binding.specHash,
        taskIds: ['task-architecture-smoke-1'],
        capabilityIds: loadedSpec.mandate.contract.capabilityIds,
        contextHandle: `ctx-architecture-smoke-${Date.now()}`,
        toolAllowlist: loadedSpec.mandate.contract.toolAllowlist,
        resourceEnvelope: { parallelism: 1 },
        attempt: 1,
      });

      const dispatchCmd = createCommandEnvelope({
        name: 'workpackage.dispatch',
        producer: 'architecture-smoke-test-coordinator',
        correlationId,
        payload: { workPackage, projectId: 'proj-smoke-onboarding' },
      });

      await fabric.publishCommand(SUBJECTS.CMD_AGENT_DISPATCH, dispatchCmd);

      let sealedArtifact: any = null;
      const startTime = Date.now();
      const timeoutMs = 150000; // generous window: this instance shares one local LLM with other live smoke tests, which can queue under concurrent load
      while (Date.now() - startTime < timeoutMs) {
        const artifacts = await artifactStore.list();
        const match = artifacts.find((a) => a.producedFor === workPackage.execId);
        if (match) {
          sealedArtifact = match;
          break;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }

      await agentWorker.stop();
      await sub.stop();
      await fabric.jsm.consumers.delete(STREAMS.COMMANDS, `${workerServiceName}-dispatch`).catch(() => {});
      await fabric.jsm.consumers.delete(STREAMS.EVENTS, runSubDurable).catch(() => {});

      expect(sealedArtifact, 'A sealed ArchitectureDesign artifact should have been generated by the live Qwen Architecture run').toBeDefined();
      expect(sealedArtifact.artifactType).toBe('ArchitectureDesign');
      expect(sealedArtifact.contentRef).toBeTruthy();
      expect(sealedArtifact.contentHash).toBeTruthy();

      const sealRecord = artifactEngine.getSealRecord(sealedArtifact.artifactId);
      expect(sealRecord).toBeDefined();
      expect(sealRecord?.contentHash.length).toBe(64);

      const runs = await runStore.list();
      const run = runs.find((r) => r.workPackageId === workPackageId);
      expect(run).toBeDefined();
      expect(run?.status).toBe('completed');
    },
    180000,
  );
});
