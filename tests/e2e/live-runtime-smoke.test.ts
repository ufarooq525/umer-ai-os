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
import { pingMySql, createMySqlClient, closeMySql, migrate } from '../../packages/db/src/index.js';
import { createMySqlCustomerSuccessStore } from '../../packages/opportunity-intelligence/src/index.js';

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

describe('Live Runtime Smoke Test (NATS + MySQL + LM Studio Qwen)', () => {
  let isNatsAlive = false;
  let isLlmAlive = false;
  let isMySqlAlive = false;

  beforeAll(async () => {
    // Probe NATS
    try {
      const testFabric = await createMessageFabric({ servers: 'nats://localhost:4222', ensureInfrastructure: false });
      isNatsAlive = true;
    } catch {
      isNatsAlive = false;
    }

    // Probe LM Studio
    try {
      const res = await fetch('http://127.0.0.1:1234/v1/models', { signal: AbortSignal.timeout(3000) });
      isLlmAlive = res.ok;
    } catch {
      isLlmAlive = false;
    }

    // Probe MySQL
    try {
      isMySqlAlive = await pingMySql();
      if (isMySqlAlive) {
        const client = createMySqlClient();
        await migrate(client);
      }
    } catch {
      isMySqlAlive = false;
    }
  });

  afterAll(async () => {
    await closeMessageFabric();
    await closeMySql();
  });

  it('verifies live infrastructure health: NATS (4222), LM Studio (1234), and MySQL (3306)', () => {
    expect(isNatsAlive, 'NATS should be listening on port 4222').toBe(true);
    expect(isLlmAlive, 'LM Studio should be listening on port 1234').toBe(true);
    expect(isMySqlAlive, 'MySQL should be listening on port 3306').toBe(true);
  });

  it('executes live specialist execution: Requirement → NATS dispatch → Agent Worker → Live Qwen 3 8B LLM → Sealed ProductBrief Artifact', async () => {
    if (!isNatsAlive || !isLlmAlive) {
      console.warn('Skipping live LLM worker test: NATS or LM Studio not responsive');
      return;
    }

    const fabric = await createMessageFabric({
      servers: 'nats://localhost:4222',
      producer: 'smoke-test-fabric',
    });

    const specPath = join(repoRoot, 'specialists', 'program', 'product-definition.md');
    const loadedSpec = await loadSpecFromFile(specPath);

    const registry = new InMemoryRegistryAdapter();
    await registry.register(loadedSpec.binding);

    const { engine: artifactEngine, store: artifactStore } = createArtifactStack();
    const runStore = new InMemoryAgentRunReadModelStore();
    const sub = await subscribeAgentRunReadModel(fabric, runStore, {
      durable: `smoke-run-sub-${Date.now()}`,
    });

    const debugSub = await fabric.subscribeEvents(
      {
        stream: STREAMS.EVENTS,
        durable: `smoke-debug-${Date.now()}`,
        filterSubject: 'evt.runtime.agent.>',
      },
      async (evt, ctx) => {
        console.log('[SMOKE-EVENT]', evt.name, JSON.stringify(evt.payload));
        ctx.ack();
      },
    );

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
    const workerServiceName = `smoke-worker-${Date.now()}`;
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
        name: 'Product Definition Specialist',
        department: 'Product',
        capabilityIds: ['cap.product.definition'],
      }),
      deliverPolicy: DeliverPolicy.New,
    });

    await agentWorker.start();

    const correlationId = `corr-smoke-${Date.now()}`;
    const workPackageId = `wp-smoke-${Date.now()}`;
    const instruction = 'Define a concise product scope under 250 words, with 3 core user stories and 3 acceptance criteria for an automated client onboarding portal.';

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
      execId: 'EXEC-901',
      stage: 'Product',
      status: 'Dispatched',
      specialistId: loadedSpec.binding.specialistId,
      specialistSpecVersion: loadedSpec.binding.specVersion,
      specialistSpecHash: loadedSpec.binding.specHash,
      taskIds: ['task-smoke-1'],
      capabilityIds: loadedSpec.mandate.contract.capabilityIds,
      contextHandle: `ctx-smoke-${Date.now()}`,
      toolAllowlist: loadedSpec.mandate.contract.toolAllowlist,
      resourceEnvelope: { parallelism: 1 },
      attempt: 1,
    });

    // Dispatch work package via NATS JetStream command
    const dispatchCmd = createCommandEnvelope({
      name: 'workpackage.dispatch',
      producer: 'smoke-test-coordinator',
      correlationId,
      payload: {
        workPackage,
        projectId: 'proj-smoke-onboarding',
      },
    });

    await fabric.publishCommand(SUBJECTS.CMD_AGENT_DISPATCH, dispatchCmd);

    // Wait for the live LLM turn to execute, create artifact, and emit completion event
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
    await debugSub.stop();

    expect(sealedArtifact, 'Sealed artifact should have been generated by live Qwen execution').toBeDefined();
    expect(sealedArtifact.artifactType).toBe('ProductBrief');
    expect(sealedArtifact.contentRef).toBeTruthy();
    expect(sealedArtifact.contentHash).toBeTruthy();

    // Verify SHA-256 seal record
    const sealRecord = artifactEngine.getSealRecord(sealedArtifact.artifactId);
    expect(sealRecord).toBeDefined();
    expect(sealRecord?.contentHash).toBeTruthy();
    expect(sealRecord?.contentHash.length).toBe(64); // SHA-256 hex string

    // Verify Agent Run was projected into Read Model
    const runs = await runStore.list();
    const run = runs.find((r) => r.workPackageId === workPackageId);
    expect(run).toBeDefined();
    expect(run?.status).toBe('completed');
  }, 120000);

  it('proves MySQL durability across process restart for customer success and commercial entities', async () => {
    if (!isMySqlAlive) return;

    const testCustomerId = `cust-smoke-${Date.now()}`;
    const testProjectId = `proj-smoke-${Date.now()}`;

    // Process 1: Write state to MySQL
    const store1 = createMySqlCustomerSuccessStore();
    await store1.saveCustomer({
      id: testCustomerId,
      prospectId: `prosp-smoke-${Date.now()}`,
      companyName: 'Apex Live Systems Corp',
      status: 'active',
      healthScore: 95,
      healthTier: 'healthy',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await store1.saveDeliveryOutcome({
      id: `out-${testProjectId}`,
      projectId: testProjectId,
      customerId: testCustomerId,
      status: 'successful',
      deliveredAt: new Date().toISOString(),
      scopeDeliveredPercent: 100,
      acceptanceCriteriaMet: true,
      clientSignoff: {
        signedBy: 'Marcus Vance',
        signedAt: new Date().toISOString(),
        clientSatisfactionScore: 5,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Simulate process restart: create a fresh store instance
    const store2 = createMySqlCustomerSuccessStore();
    const reloadedCustomer = await store2.getCustomer(testCustomerId);
    const reloadedOutcome = await store2.getDeliveryOutcome(testProjectId);

    expect(reloadedCustomer).toBeDefined();
    expect(reloadedCustomer?.companyName).toBe('Apex Live Systems Corp');
    expect(reloadedCustomer?.healthScore).toBe(95);

    expect(reloadedOutcome).toBeDefined();
    expect(reloadedOutcome?.status).toBe('successful');
    expect(reloadedOutcome?.clientSignoff.signedBy).toBe('Marcus Vance');
    expect(reloadedOutcome?.clientSignoff.clientSatisfactionScore).toBe(5);
  });
});
