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
import { createLLMProviderFromEnv } from '../../packages/model-routing/src/index.js';
import { InMemoryAgentRunReadModelStore } from '../../packages/observability/src/index.js';
import { buildGateReview } from '../../apps/control-api/src/gate-review.js';
import { applyEngOnGatePass, type ControlApiState } from '../../apps/control-api/src/state.js';
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
    const child = spawn(command, args, { cwd, shell: true, windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d) => (stdout += String(d)));
    child.stderr?.on('data', (d) => (stderr += String(d)));
    child.on('close', (code) => resolve({ code, stdout, stderr }));
    child.on('error', (err) => resolve({ code: 1, stdout, stderr: String(err) }));
  });
}

/**
 * Full Live Autonomous Engineering Workflow Smoke Test:
 *
 *   Work Package
 *   -> JetStream NATS Dispatch
 *   -> Real Agent Worker
 *   -> Real Agent Runtime
 *   -> Real Qwen 3 8B LLM CodeProducer via LM Studio
 *   -> Real Repository Inspection (readProjectFile)
 *   -> Isolated Staging Workspace (mkdtemp)
 *   -> Real Code Change applied in staging
 *   -> Real PHPUnit Execution in staging
 *   -> Real Unified Git Diff capture
 *   -> Sealed Code Artifact generation with SHA-256 seal
 *   -> Evidence preservation (.umer/eng/<runId>/evidence)
 *   -> Gate Review assembly for CEO inspection
 *   -> CEO Gate Approval (Pass)
 *   -> Real Controlled Apply to project repository
 *   -> Hand-off to QA and Security in canonical Work Graph
 */
describe('Live Autonomous Engineering Workflow (Qwen 3 8B + NATS + Staging + PHPUnit + Gate Review + Apply)', () => {
  let isNatsAlive = false;
  let isLlmAlive = false;
  let fixtureRoot = '';
  let fabric: MessageFabricClient | undefined;

  beforeAll(async () => {
    try {
      fabric = await createMessageFabric({
        servers: 'nats://localhost:4222',
        producer: 'eng-autonomous-test-fabric',
      });
      isNatsAlive = true;
    } catch {
      isNatsAlive = false;
    }

    try {
      const ping = await fetch('http://127.0.0.1:1234/v1/models');
      isLlmAlive = ping.ok;
    } catch {
      isLlmAlive = false;
    }
  });

  afterAll(async () => {
    await closeMessageFabric();
  });

  afterEach(async () => {
    if (fixtureRoot) {
      await rm(fixtureRoot, { recursive: true, force: true });
      fixtureRoot = '';
    }
  });

  it.skipIf(process.env.CI === 'true')(
    'executes real autonomous code delivery via Qwen 3 8B, verifies staging isolation and PHPUnit tests, seals Code artifact, reviews gate diff, and applies change on gate Pass',
    async () => {
      if (!isNatsAlive || !fabric) {
        console.warn('Skipping live autonomous engineering test: NATS not responsive');
        return;
      }
      if (!isLlmAlive) {
        console.warn('Skipping live autonomous engineering test: LM Studio Qwen model not responsive on port 1234');
        return;
      }

      // 1. Create a real PHPUnit fixture project
      fixtureRoot = await mkdtemp(join(tmpdir(), 'umer-eng-autonomous-'));
      const baselineMath = [
        '<?php',
        '',
        'class Math',
        '{',
        '    public static function add($a, $b)',
        '    {',
        '        return $a + $b;',
        '    }',
        '}',
        '',
      ].join('\n');

      const baselineTest = [
        '<?php',
        '',
        'use PHPUnit\\Framework\\TestCase;',
        "require_once __DIR__ . '/../Math.php';",
        '',
        'class MathTest extends TestCase',
        '{',
        '    public function testAdd()',
        '    {',
        '        $this->assertEquals(5, Math::add(2, 3));',
        '    }',
        '}',
        '',
      ].join('\n');

      await writeFile(
        join(fixtureRoot, 'composer.json'),
        JSON.stringify(
          {
            name: 'umer/autonomous-eng-fixture',
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
      await mkdir(join(fixtureRoot, 'tests'), { recursive: true });
      await writeFile(join(fixtureRoot, 'tests', 'MathTest.php'), baselineTest, 'utf8');

      const composerInstall = await runCommand(
        'composer',
        ['install', '--no-interaction', '--quiet'],
        fixtureRoot,
      );
      if (composerInstall.code !== 0) {
        console.warn('Skipping live autonomous engineering test: composer install failed', composerInstall.stderr);
        return;
      }

      // 2. Configure Real Qwen 3 8B LLM Provider & LlmCodeProducer
      const llmProvider = createLLMProviderFromEnv({
        env: {
          LLM_PROVIDER: 'lmstudio',
          LLM_BASE_URL: 'http://127.0.0.1:1234/v1',
          LLM_MODEL: 'qwen/qwen3-8b',
          LLM_REQUEST_TIMEOUT_MS: 120000,
          LLM_TEMPERATURE: 0.1,
          LLM_MAX_TOKENS: 4096,
        },
      });

      const codeProducer = createLlmCodeProducer({
        provider: llmProvider,
        model: 'qwen/qwen3-8b',
        temperature: 0.1,
      });

      // 3. Register Specialist & start AgentWorker
      const specPath = join(repoRoot, 'specialists', 'engineering', 'application-delivery.md');
      const loadedSpec = await loadSpecFromFile(specPath);
      const registry = new InMemoryRegistryAdapter();
      await registry.register(loadedSpec.binding);

      const { engine: artifactEngine, store: artifactStore } = createArtifactStack();
      const runStore = new InMemoryAgentRunReadModelStore();
      const runSubDurable = `eng-auto-run-sub-${Date.now()}`;
      const sub = await subscribeAgentRunReadModel(fabric, runStore, {
        durable: runSubDurable,
      });

      const workerServiceName = `eng-auto-worker-${Date.now()}`;
      const agentWorker = createAgentWorker({
        runtime: createAgentRuntime({
          resolveMandate: async (id) =>
            id === loadedSpec.binding.specialistId
              ? { mandate: loadedSpec.mandate, binding: loadedSpec.binding }
              : undefined,
          events: createMessageFabricAgentEventPublisher(fabric, workerServiceName),
          codeProducer,
        }),
        fabric,
        producer: workerServiceName,
        durablePrefix: workerServiceName,
        artifactEngine,
        resolveAgentDisplay: () => ({
          name: 'Application Delivery Specialist',
          department: 'Engineering',
          capabilityIds: ['cap.eng.delivery'],
        }),
        deliverPolicy: DeliverPolicy.New,
      });

      await agentWorker.start();

      // 4. Dispatch Real Work Package targeting the fixture
      const correlationId = `corr-eng-auto-${Date.now()}`;
      const workPackageId = `wp-eng-auto-${Date.now()}`;
      const instruction =
        'Add a multiply(a, b) method to Math.php with real PHPUnit coverage in tests/MathTest.php, matching the existing add() convention.';

      const workPackage = parseContract(WorkPackageContractSchema, {
        id: `pkg-${workPackageId}`,
        schemaVersion: SCHEMA_VERSION,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {
          labels: { environment: 'smoke' },
          annotations: {
            instruction,
            projectId: 'proj-eng-auto-fixture',
            targetFiles: 'Math.php,tests/MathTest.php',
          },
        },
        kind: 'work_package',
        workPackageId,
        execId: 'EXEC-905',
        stage: 'Implementation',
        status: 'Dispatched',
        specialistId: loadedSpec.binding.specialistId,
        specialistSpecVersion: loadedSpec.binding.specVersion,
        specialistSpecHash: loadedSpec.binding.specHash,
        taskIds: ['task-eng-auto-1'],
        capabilityIds: loadedSpec.mandate.contract.capabilityIds,
        contextHandle: `ctx-eng-auto-${Date.now()}`,
        toolAllowlist: loadedSpec.mandate.contract.toolAllowlist,
        resourceEnvelope: { parallelism: 1 },
        targetPath: fixtureRoot,
        attempt: 1,
      });

      const dispatchCmd = createCommandEnvelope({
        name: 'workpackage.dispatch',
        producer: 'eng-auto-coordinator',
        correlationId,
        payload: { workPackage, projectId: 'proj-eng-auto-fixture' },
      });

      await fabric.publishCommand(SUBJECTS.CMD_AGENT_DISPATCH, dispatchCmd);

      // 5. Wait for the real sealed Code artifact
      let sealedArtifact: any = null;
      const expectedArtifactId = `art-${workPackage.workPackageId}-${workPackage.attempt}`;
      const startTime = Date.now();
      const timeoutMs = 120000;
      while (Date.now() - startTime < timeoutMs) {
        const artifacts = await artifactStore.list();
        const match = artifacts.find((a) => a.artifactId === expectedArtifactId);
        if (match) {
          sealedArtifact = match;
          break;
        }
        await new Promise((r) => setTimeout(r, 1000));
      }

      console.log('Sealed artifact matched:', JSON.stringify(sealedArtifact, null, 2));

      await agentWorker.stop();
      await sub.stop();
      await fabric.jsm.consumers.delete(STREAMS.COMMANDS, `${workerServiceName}-dispatch`).catch(() => {});
      await fabric.jsm.consumers.delete(STREAMS.EVENTS, runSubDurable).catch(() => {});

      // 6. Assert artifact & execution evidence
      expect(sealedArtifact, 'A Code artifact should have been sealed by the autonomous delivery run').toBeDefined();
      expect(sealedArtifact.artifactType).toBe('Code');
      expect(sealedArtifact.acceptanceStatus).toBe('submitted');
      expect(sealedArtifact.contentHash).toBeTruthy();

      const annotations = (sealedArtifact.metadata?.annotations ?? {}) as Record<string, string>;
      console.log('Annotations:', annotations);
      expect(Number(annotations.filesChanged)).toBeGreaterThanOrEqual(1);
      expect(annotations.testsRan, 'Staged PHPUnit suite must have actually executed').toBe('true');
      expect(annotations.testsPassed, 'Staged PHPUnit suite must have passed').toBe('true');
      expect(annotations.proposedDiff).toContain('multiply');

      // 7. Staging Isolation Guarantee: original fixture remains untouched pending gate approval
      const sourceMathBeforeGate = await readFile(join(fixtureRoot, 'Math.php'), 'utf8');
      expect(sourceMathBeforeGate).toBe(baselineMath);
      expect(sourceMathBeforeGate).not.toContain('multiply');

      // 8. Gate Review Assembly for the CEO
      const gateWaitId = `wait-eng-auto-${Date.now()}`;
      const gateId = `gate-wp-${workPackageId}`;

      const gateReview = buildGateReview({
        gate: { waitId: gateWaitId, gateId, workPackageId },
        intakes: [],
        workPackages: [
          {
            workPackageId,
            execId: workPackage.execId,
            status: 'AwaitingReview',
            specialistId: loadedSpec.binding.specialistId,
            stage: 'Implementation',
            projectId: 'proj-eng-auto-fixture',
            artifactId: sealedArtifact.artifactId,
          },
        ],
        artifacts: [sealedArtifact],
      });

      expect(gateReview).toBeDefined();
      expect(gateReview?.kind).toBe('code');
      expect(gateReview?.code?.filesChanged).toBeGreaterThanOrEqual(1);
      expect(gateReview?.code?.testsPassed).toBe(true);
      expect(gateReview?.headline).toContain('staged tests passed');

      // 9. CEO Gate Approval & Controlled Apply to Project
      const mockCatalog = {
        version: '1.0.0-test',
        defaultProjectsRoot: tmpdir(),
        projects: [
          {
            projectId: 'proj-eng-auto-fixture',
            name: 'Autonomous Fixture Project',
            slug: 'proj-eng-auto-fixture',
            path: fixtureRoot,
            status: 'active' as const,
            category: 'digital-product' as const,
            stack: ['php'],
            defaultSpecialists: ['eng.app-delivery'],
            constraints: [],
            tags: [],
          },
        ],
      };
      const projectRegistry = await createProjectRegistry({
        catalogPath: join(fixtureRoot, 'non-existent-catalog.json'),
      }).catch(() => {
        // Fallback using memory catalog
        return {
          requireActive: () => ({
            projectId: 'proj-eng-auto-fixture',
            name: 'Autonomous Fixture Project',
            slug: 'proj-eng-auto-fixture',
            path: fixtureRoot,
            absolutePath: fixtureRoot,
            status: 'active' as const,
            category: 'digital-product' as const,
            stack: ['php'],
            defaultSpecialists: ['eng.app-delivery'],
            constraints: [],
            tags: [],
            autoApplyEng: false,
            onDisk: true,
          }),
        } as any;
      });

      const controlApiState: ControlApiState = {
        controlPlane: createControlPlaneService(),
        auditService: createAuditService(),
        workPackages: [
          {
            workPackageId,
            execId: workPackage.execId,
            status: 'AwaitingReview',
            specialistId: loadedSpec.binding.specialistId,
            stage: 'Implementation',
            projectId: 'proj-eng-auto-fixture',
            artifactId: sealedArtifact.artifactId,
          },
        ],
        projectRegistry,
        intakes: [],
        bus: createEventBus(),
        artifactStore,
      };

      const applyOutcome = await applyEngOnGatePass(controlApiState, {
        workPackageId,
        gateId,
        rationale: 'CEO approved autonomous delivery after reviewing verified diff and PHPUnit tests',
        approver: 'ceo.operator',
      });

      expect(applyOutcome, 'Approved change must be applied to repository upon gate Pass').toBeDefined();
      expect(applyOutcome?.diffApplied).toBe(true);

      // 10. Verify Real Mutation on Target Workspace after Gate Pass
      const sourceMathAfterGate = await readFile(join(fixtureRoot, 'Math.php'), 'utf8');
      expect(sourceMathAfterGate).toContain('multiply');

      // 11. Verify Run PHPUnit directly on the newly updated project
      const finalTestSuiteRun = await runCommand(
        join(fixtureRoot, 'vendor', 'bin', 'phpunit'),
        [],
        fixtureRoot,
      );
      expect(finalTestSuiteRun.code).toBe(0);
      expect(finalTestSuiteRun.stdout).toContain('OK');
    },
    240000,
  );
});
