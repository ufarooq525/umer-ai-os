import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
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
import {
  createAgentRuntime,
  createAgentWorker,
  createLlmCodeProducer,
  createMessageFabricAgentEventPublisher,
  subscribeAgentRunReadModel,
} from '@umer/agent-runtime';
import { createToolRegistry, createToolRouter, createFilesystemReadTool, createFilesystemListTool, createProcessRecommendTool } from '../../packages/extension/src/index.js';
import { createLLMProviderFromEnv } from '../../packages/model-routing/src/index.js';
import { InMemoryAgentRunReadModelStore } from '../../packages/observability/src/index.js';
import { buildGateReview } from '../../apps/control-api/src/gate-review.js';
import { applyEngOnGatePass, applyQaOnGatePass, type ControlApiState } from '../../apps/control-api/src/state.js';
import { createProjectRegistry } from '../../packages/registry/src/index.js';
import { createControlPlaneService } from '../../packages/control-plane/src/index.js';
import { createAuditService } from '../../packages/audit/src/index.js';
import { createEventBus } from '../../packages/event-bus/src/index.js';

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

function runCommand(
  command: string,
  args: string[],
  cwd: string,
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, { cwd, shell: true });
    let stdout = '';
    let stderr = '';
    proc.stdout?.on('data', (d) => {
      stdout += d.toString();
    });
    proc.stderr?.on('data', (d) => {
      stderr += d.toString();
    });
    proc.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

describe('Live Autonomous QA Handoff Workflow (Engineering Code Artifact -> QA Work Package -> qa.verify -> TestPlanResults -> QA Gate)', () => {
  let isNatsAlive = false;
  let isLlmAlive = false;
  let fabric: MessageFabricClient | undefined;
  let fixtureRoot: string;
  let vendorPath: string;

  beforeAll(async () => {
    try {
      fabric = await createMessageFabric({
        servers: 'nats://localhost:4222',
        producer: 'live-qa-handoff-fabric',
      });
      isNatsAlive = true;
    } catch {
      isNatsAlive = false;
    }

    try {
      const res = await fetch('http://127.0.0.1:1234/v1/models', {
        signal: AbortSignal.timeout(3000),
      });
      isLlmAlive = res.ok;
    } catch {
      isLlmAlive = false;
    }

    vendorPath = join(repoRoot, 'vendor');
  });

  afterAll(async () => {
    await closeMessageFabric();
  });

  afterEach(async () => {
    if (fixtureRoot) {
      await rm(fixtureRoot, { recursive: true, force: true }).catch(() => {});
    }
  });

  it(
    'executes autonomous engineering delivery, hands off Code artifact diff to qa.verify, seals TestPlanResults, and approves QA gate',
    async () => {
      if (!isNatsAlive || !isLlmAlive || !fabric) {
        console.warn('Skipping test: NATS or LM Studio not running locally');
        return;
      }

      // 1. Create real project fixture with PHPUnit
      fixtureRoot = await mkdtemp(join(tmpdir(), 'umer-live-qa-handoff-'));
      const fixtureVendor = join(fixtureRoot, 'vendor');
      const fixtureTests = join(fixtureRoot, 'tests');
      await mkdir(fixtureTests, { recursive: true });

      const baselineMath = `<?php

class Math
{
    public static function add($a, $b)
    {
        return $a + $b;
    }
}
`;
      await writeFile(join(fixtureRoot, 'Math.php'), baselineMath, 'utf8');

      const baselineTest = `<?php

use PHPUnit\\Framework\\TestCase;
require_once __DIR__ . '/../Math.php';

class MathTest extends TestCase
{
    public function testAdd()
    {
        $this->assertEquals(5, Math::add(2, 3));
    }
}
`;
      await writeFile(
        join(fixtureRoot, 'composer.json'),
        JSON.stringify(
          {
            name: 'umer/autonomous-qa-fixture',
            'require-dev': { 'phpunit/phpunit': '^11' },
          },
          null,
          2,
        ),
        'utf8',
      );
      await writeFile(
        join(fixtureRoot, 'phpunit.xml'),
        '<?xml version="1.0" encoding="UTF-8"?>\n<phpunit bootstrap="vendor/autoload.php"><testsuites><testsuite name="Unit"><directory>tests</directory></testsuite></testsuites></phpunit>\n',
        'utf8',
      );
      await writeFile(join(fixtureRoot, 'Math.php'), baselineMath, 'utf8');
      await writeFile(join(fixtureTests, 'MathTest.php'), baselineTest, 'utf8');

      const composerInstall = await runCommand(
        'composer',
        ['install', '--no-interaction', '--quiet'],
        fixtureRoot,
      );
      if (composerInstall.code !== 0) {
        console.warn('Skipping live autonomous QA test: composer install failed', composerInstall.stderr);
        return;
      }

      // Verify baseline test suite passes
      const baselineRun = await runCommand(
        process.platform === 'win32' ? 'vendor\\bin\\phpunit' : './vendor/bin/phpunit',
        [],
        fixtureRoot,
      );
      expect(baselineRun.code, 'Baseline PHPUnit suite must be functional').toBe(0);

      // 2. Setup Agent Worker with LLM CodeProducer & QA Tools
      const llmProvider = createLLMProviderFromEnv({
        env: {
          LLM_PROVIDER: 'lmstudio',
          LLM_BASE_URL: 'http://127.0.0.1:1234/v1',
          LLM_MODEL: 'qwen/qwen3-8b',
          LLM_TEMPERATURE: 0.1,
          LLM_MAX_TOKENS: 4096,
        },
      });

      const codeProducer = createLlmCodeProducer({
        provider: llmProvider,
        model: 'qwen/qwen3-8b',
        temperature: 0.1,
      });

      const engSpec = await loadSpecFromFile(join(repoRoot, 'specialists', 'engineering', 'application-delivery.md'));
      const qaSpec = await loadSpecFromFile(join(repoRoot, 'specialists', 'qa', 'qa-verify.md'));

      const registry = new InMemoryRegistryAdapter();
      await registry.register(engSpec.binding);
      await registry.register(qaSpec.binding);

      const toolRegistry = createToolRegistry();
      toolRegistry.register(createFilesystemReadTool());
      toolRegistry.register(createFilesystemListTool());
      toolRegistry.register(createProcessRecommendTool());
      const toolRouter = createToolRouter({ registry: toolRegistry });

      const { engine: artifactEngine, store: artifactStore } = createArtifactStack();
      const runStore = new InMemoryAgentRunReadModelStore();
      const runSubDurable = `qa-handoff-run-sub-${Date.now()}`;
      const sub = await subscribeAgentRunReadModel(fabric, runStore, { durable: runSubDurable });

      const workerServiceName = `qa-handoff-worker-${Date.now()}`;
      const agentWorker = createAgentWorker({
        runtime: createAgentRuntime({
          resolveMandate: async (id) => {
            if (id === engSpec.binding.specialistId) return { mandate: engSpec.mandate, binding: engSpec.binding };
            if (id === qaSpec.binding.specialistId) return { mandate: qaSpec.mandate, binding: qaSpec.binding };
            return undefined;
          },
          events: createMessageFabricAgentEventPublisher(fabric, workerServiceName),
          codeProducer,
          llm: {
            provider: llmProvider,
            toolRegistry,
            toolRouter,
            maxIterations: 10,
            runTimeoutMs: 120000,
            temperature: 0.1,
            maxTokens: 2048,
          },
        }),
        fabric,
        producer: workerServiceName,
        durablePrefix: workerServiceName,
        artifactEngine,
        resolveAgentDisplay: (specialistId) => {
          if (specialistId === engSpec.binding.specialistId) {
            return { name: 'Application Delivery Specialist', department: 'Engineering', capabilityIds: ['cap.eng.delivery'] };
          }
          return { name: 'QA Verify Specialist', department: 'QA', capabilityIds: ['cap.qa.verify'] };
        },
        deliverPolicy: DeliverPolicy.New,
      });

      await agentWorker.start();

      // 3. Dispatch Engineering Work Package to implement multiply()
      const engWpId = `wp-eng-handoff-${Date.now()}`;
      const engInstruction = 'Add a multiply(a, b) method to Math.php with unit test coverage in tests/MathTest.php.';

      const engWorkPackage = parseContract(WorkPackageContractSchema, {
        id: `pkg-${engWpId}`,
        schemaVersion: SCHEMA_VERSION,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {
          labels: { stage: 'implementation' },
          annotations: {
            instruction: engInstruction,
            projectId: 'proj-qa-handoff',
            targetFiles: 'Math.php,tests/MathTest.php',
          },
        },
        kind: 'work_package',
        workPackageId: engWpId,
        execId: 'EXEC-906',
        stage: 'Implementation',
        status: 'Dispatched',
        specialistId: engSpec.binding.specialistId,
        specialistSpecVersion: engSpec.binding.specVersion,
        specialistSpecHash: engSpec.binding.specHash,
        taskIds: ['task-eng-handoff-1'],
        capabilityIds: engSpec.mandate.contract.capabilityIds,
        contextHandle: `ctx-eng-handoff-${Date.now()}`,
        toolAllowlist: engSpec.mandate.contract.toolAllowlist,
        resourceEnvelope: { parallelism: 1 },
        targetPath: fixtureRoot,
        attempt: 1,
      });

      await fabric.publishCommand(
        SUBJECTS.CMD_AGENT_DISPATCH,
        createCommandEnvelope({
          name: 'workpackage.dispatch',
          producer: 'handoff-coordinator',
          correlationId: `corr-eng-${Date.now()}`,
          payload: { workPackage: engWorkPackage, projectId: 'proj-qa-handoff' },
        }),
      );

      // Wait for Code artifact
      let codeArtifact: any = null;
      const expectedEngArtifactId = `art-${engWpId}-1`;
      const t0 = Date.now();
      while (Date.now() - t0 < 90000) {
        const artifacts = await artifactStore.list();
        const found = artifacts.find((a) => a.artifactId === expectedEngArtifactId);
        if (found) {
          codeArtifact = found;
          break;
        }
        await new Promise((r) => setTimeout(r, 1000));
      }

      expect(codeArtifact, 'Engineering agent must seal Code artifact').toBeDefined();
      expect(codeArtifact.artifactType).toBe('Code');
      expect(codeArtifact.acceptanceStatus).toBe('submitted');

      // 4. CEO Approves Engineering Gate Pass -> Applies to Workspace
      const projectRegistry = {
        requireActive: () => ({
          projectId: 'proj-qa-handoff',
          name: 'QA Handoff Project',
          slug: 'qa-handoff',
          path: fixtureRoot,
          absolutePath: fixtureRoot,
          status: 'active' as const,
          category: 'digital-product' as const,
          stack: ['php'],
          defaultSpecialists: ['eng.app-delivery', 'qa.verify'],
          constraints: [],
          tags: [],
          autoApplyEng: false,
          onDisk: true,
          qaTestCommand: process.platform === 'win32' ? 'vendor\\bin\\phpunit' : './vendor/bin/phpunit',
        }),
        get: () => ({
          projectId: 'proj-qa-handoff',
          name: 'QA Handoff Project',
          slug: 'qa-handoff',
          path: fixtureRoot,
          absolutePath: fixtureRoot,
          status: 'active' as const,
          category: 'digital-product' as const,
          stack: ['php'],
          defaultSpecialists: ['eng.app-delivery', 'qa.verify'],
          constraints: [],
          tags: [],
          autoApplyEng: false,
          onDisk: true,
          qaTestCommand: process.platform === 'win32' ? 'vendor\\bin\\phpunit' : './vendor/bin/phpunit',
        }),
        list: () => [],
      } as any;
      const controlState: ControlApiState = {
        controlPlane: createControlPlaneService({ auditService: createAuditService() }),
        auditService: createAuditService(),
        workPackages: [
          {
            workPackageId: engWpId,
            execId: 'EXEC-906',
            status: 'AwaitingReview',
            specialistId: 'eng.app-delivery',
            stage: 'Implementation',
            projectId: 'proj-qa-handoff',
            artifactId: codeArtifact.artifactId,
          },
        ],
        projectRegistry,
        intakes: [],
        bus: createEventBus(),
        artifactStore,
      };

      const engApply = await applyEngOnGatePass(controlState, {
        workPackageId: engWpId,
        gateId: `gate-wp-${engWpId}`,
        rationale: 'Approved engineering implementation for QA handoff',
        approver: 'ceo.operator',
      });

      expect(engApply, 'Engineering gate pass must apply code to target project').toBeDefined();
      expect(engApply?.diffApplied).toBe(true);

      const modifiedMath = await readFile(join(fixtureRoot, 'Math.php'), 'utf8');
      expect(modifiedMath).toContain('multiply');

      // 5. Autonomous QA Handoff: Dispatch QA Work Package Grounded with Code Diff
      const engAnnotations = (codeArtifact.metadata?.annotations ?? {}) as Record<string, string>;
      const qaWpId = `wp-qa-handoff-${Date.now()}`;
      const qaInstruction =
        `Verify the new implementation for project proj-qa-handoff.\n\n` +
        `Preceding Implementation Artifact: ${codeArtifact.artifactId}\n` +
        `Files Changed: ${engAnnotations.filesChanged} file(s)\n` +
        `Staged Tests Status: testsRan=${engAnnotations.testsRan}, testsPassed=${engAnnotations.testsPassed}\n` +
        `Implementation Diff:\n\`\`\`diff\n${engAnnotations.proposedDiff}\n\`\`\`\n\n` +
        `Inspect the repository test suite and files, evaluate quality and unit coverage for the multiply method, and produce verification evidence.`;

      const qaWorkPackage = parseContract(WorkPackageContractSchema, {
        id: `pkg-${qaWpId}`,
        schemaVersion: SCHEMA_VERSION,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {
          labels: { stage: 'qa' },
          annotations: {
            instruction: qaInstruction,
            projectId: 'proj-qa-handoff',
            precedingArtifactId: codeArtifact.artifactId,
          },
        },
        kind: 'work_package',
        workPackageId: qaWpId,
        execId: 'EXEC-907',
        stage: 'QA',
        status: 'Dispatched',
        specialistId: qaSpec.binding.specialistId,
        specialistSpecVersion: qaSpec.binding.specVersion,
        specialistSpecHash: qaSpec.binding.specHash,
        taskIds: ['task-qa-handoff-1'],
        capabilityIds: qaSpec.mandate.contract.capabilityIds,
        contextHandle: `ctx-qa-handoff-${Date.now()}`,
        toolAllowlist: qaSpec.mandate.contract.toolAllowlist,
        resourceEnvelope: { parallelism: 1 },
        targetPath: fixtureRoot,
        attempt: 1,
      });

      await fabric.publishCommand(
        SUBJECTS.CMD_AGENT_DISPATCH,
        createCommandEnvelope({
          name: 'workpackage.dispatch',
          producer: 'handoff-coordinator',
          correlationId: `corr-qa-${Date.now()}`,
          payload: { workPackage: qaWorkPackage, projectId: 'proj-qa-handoff' },
        }),
      );

      // Wait for QA TestPlanResults artifact
      let qaArtifact: any = null;
      const expectedQaArtifactId = `art-${qaWpId}-1`;
      const t1 = Date.now();
      while (Date.now() - t1 < 90000) {
        const artifacts = await artifactStore.list();
        const found = artifacts.find((a) => a.artifactId === expectedQaArtifactId);
        if (found) {
          qaArtifact = found;
          break;
        }
        await new Promise((r) => setTimeout(r, 1000));
      }

      await agentWorker.stop();
      await sub.stop();
      await fabric.jsm.consumers.delete(STREAMS.COMMANDS, `${workerServiceName}-dispatch`).catch(() => {});
      await fabric.jsm.consumers.delete(STREAMS.EVENTS, runSubDurable).catch(() => {});

      expect(qaArtifact, 'QA specialist must seal TestPlanResults artifact').toBeDefined();
      expect(qaArtifact.artifactType).toBe('TestPlanResults');
      expect(qaArtifact.acceptanceStatus).toBe('submitted');

      // 6. QA Gate Review Assembly
      const qaGateReview = buildGateReview({
        gate: { waitId: 'wait-qa-gate-1', gateId: `gate-wp-${qaWpId}`, workPackageId: qaWpId },
        intakes: [],
        projectRegistry,
        workPackages: [
          {
            workPackageId: qaWpId,
            execId: 'EXEC-907',
            status: 'AwaitingReview',
            specialistId: 'qa.verify',
            stage: 'QA',
            projectId: 'proj-qa-handoff',
            artifactId: qaArtifact.artifactId,
          },
        ],
        artifacts: [qaArtifact],
      });

      expect(qaGateReview).toBeDefined();
      expect(qaGateReview?.kind).toBe('findings');
      expect(qaGateReview?.requestedType).toBe('qa');
      expect(qaGateReview?.headline).toContain('QA Verification');
      expect(qaGateReview?.findings?.summary).toContain('qa.verify');

      // 7. Approve QA Gate -> Executes Suites on Project and Seals QA Evidence
      controlState.workPackages.unshift({
        workPackageId: qaWpId,
        execId: 'EXEC-907',
        status: 'AwaitingReview',
        specialistId: 'qa.verify',
        stage: 'QA',
        projectId: 'proj-qa-handoff',
        artifactId: qaArtifact.artifactId,
      });

      const qaApplyResult = await applyQaOnGatePass(controlState, {
        workPackageId: qaWpId,
        gateId: `gate-wp-${qaWpId}`,
        rationale: 'QA verification completed and approved by CEO',
      });

      expect(qaApplyResult, 'QA gate pass must execute suites and return QaApplyResult').toBeDefined();
      expect(qaApplyResult?.evidenceDir).toContain('.umer');
      expect(qaApplyResult?.summary).toContain('QA verified');
    },
    240000,
  );
});
