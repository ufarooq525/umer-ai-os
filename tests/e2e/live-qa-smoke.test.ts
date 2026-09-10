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
  SUBJECTS,
  createCommandEnvelope,
  DeliverPolicy,
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
 * Live proof of the QA verification pipeline, using the SAME runtime as
 * every other specialist (no second QA framework):
 *
 *   Implementation Accepted -> QA Work Package -> real NATS dispatch ->
 *   real Agent Worker -> Agent Runtime's generic LLM loop (qa.verify is
 *   NOT in DETERMINISTIC_SPECIALISTS, unlike eng.app-delivery — see
 *   packages/agent-runtime/src/runtime.ts) -> real Qwen 3 8B completion ->
 *   sealed TestPlanResults artifact (packages/agent-runtime/src/handlers/
 *   llm-agent.ts's inferArtifactType maps department 'QA' ->
 *   'TestPlanResults') -> real Agent Run in the read model.
 *
 * Real test EXECUTION for QA is a separate, already-live-verified
 * mechanism reused as-is (not duplicated here): once a human/CEO gate
 * approves the QaAuditReport this run produces, applyQaToProject
 * (packages/registry/src/qa-apply.ts, invoked by apps/control-api/src/
 * state.ts's applyQaOnGatePass) actually runs the project's real PHPUnit/
 * Pest/Playwright suite and seals evidence under `.umer/qa/` — proven
 * live end-to-end (real fixture, real gate resolve, real PHPUnit exit
 * code) by apps/control-api/src/server.test.ts's "applies QA package
 * when approving a qa gate", using the qa-run.ts Windows fix from this
 * same session (see the Live Engineering commit).
 */
describe('Live QA Smoke Test (NATS + Agent Worker + Live Qwen 3 8B -> TestPlanResults)', () => {
  let isNatsAlive = false;
  let isLlmAlive = false;

  beforeAll(async () => {
    try {
      await createMessageFabric({ servers: 'nats://localhost:4222', ensureInfrastructure: false });
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
    'executes live QA verification: QA Work Package -> NATS dispatch -> Agent Worker -> Live Qwen 3 8B LLM -> sealed TestPlanResults Artifact',
    async () => {
      if (!isNatsAlive || !isLlmAlive) {
        console.warn('Skipping live QA test: NATS or LM Studio not responsive');
        return;
      }

      const fabric = await createMessageFabric({
        servers: 'nats://localhost:4222',
        producer: 'qa-smoke-test-fabric',
      });

      const specPath = join(repoRoot, 'specialists', 'qa', 'qa-verify.md');
      const loadedSpec = await loadSpecFromFile(specPath);

      const registry = new InMemoryRegistryAdapter();
      await registry.register(loadedSpec.binding);

      const { engine: artifactEngine, store: artifactStore } = createArtifactStack();
      const runStore = new InMemoryAgentRunReadModelStore();
      const sub = await subscribeAgentRunReadModel(fabric, runStore, {
        durable: `qa-smoke-run-sub-${Date.now()}`,
      });

      const llmProvider = createLLMProviderFromEnv({
        env: {
          LLM_PROVIDER: 'lmstudio',
          LLM_BASE_URL: 'http://127.0.0.1:1234/v1',
          LLM_MODEL: 'qwen/qwen3-8b',
          LLM_REQUEST_TIMEOUT_MS: 90000,
          LLM_TEMPERATURE: 0.2,
          LLM_MAX_TOKENS: 2048,
          AGENT_LOOP_MAX_ITERATIONS: 5,
          AGENT_LOOP_TIMEOUT_MS: 120000,
        } as any,
      });

      const toolRegistry = createToolRegistry();
      const toolRouter = createToolRouter({ registry: toolRegistry });
      const workerServiceName = `qa-smoke-worker-${Date.now()}`;
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
            runTimeoutMs: 120000,
            temperature: 0.2,
            maxTokens: 2048,
          },
        }),
        fabric,
        producer: workerServiceName,
        durablePrefix: workerServiceName,
        artifactEngine,
        resolveAgentDisplay: () => ({
          name: 'QA Verify Specialist',
          department: 'QA',
          capabilityIds: ['cap.qa.verify'],
        }),
        deliverPolicy: DeliverPolicy.New,
      });

      await agentWorker.start();

      const correlationId = `corr-qa-smoke-${Date.now()}`;
      const workPackageId = `wp-qa-smoke-${Date.now()}`;
      const instruction =
        'Produce a prioritized QA verification checklist (functional + non-functional) for an automated client onboarding portal that just had Implementation accepted: document upload, status tracking, and admin review. Identify P0 items and the suite command to run.';

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
        execId: 'EXEC-903',
        stage: 'QA',
        status: 'Dispatched',
        specialistId: loadedSpec.binding.specialistId,
        specialistSpecVersion: loadedSpec.binding.specVersion,
        specialistSpecHash: loadedSpec.binding.specHash,
        taskIds: ['task-qa-smoke-1'],
        capabilityIds: loadedSpec.mandate.contract.capabilityIds,
        contextHandle: `ctx-qa-smoke-${Date.now()}`,
        toolAllowlist: loadedSpec.mandate.contract.toolAllowlist,
        resourceEnvelope: { parallelism: 1 },
        attempt: 1,
      });

      const dispatchCmd = createCommandEnvelope({
        name: 'workpackage.dispatch',
        producer: 'qa-smoke-test-coordinator',
        correlationId,
        payload: { workPackage, projectId: 'proj-smoke-onboarding' },
      });

      await fabric.publishCommand(SUBJECTS.CMD_AGENT_DISPATCH, dispatchCmd);

      let sealedArtifact: any = null;
      const startTime = Date.now();
      const timeoutMs = 90000;
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

      expect(sealedArtifact, 'A sealed TestPlanResults artifact should have been generated by the live Qwen QA run').toBeDefined();
      expect(sealedArtifact.artifactType).toBe('TestPlanResults');
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
    120000,
  );
});
