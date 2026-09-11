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
import {
  createToolRegistry,
  createToolRouter,
  createFilesystemReadTool,
  createFilesystemWriteTool,
  createFilesystemListTool,
  createProcessRecommendTool,
  createProcessRunAuditTool,
} from '../../packages/extension/src/index.js';
import { createLLMProviderFromEnv } from '../../packages/model-routing/src/index.js';
import { InMemoryAgentRunReadModelStore } from '../../packages/observability/src/index.js';
import { buildGateReview } from '../../apps/control-api/src/gate-review.js';
import { applyEngOnGatePass, applySecurityOnGatePass, type ControlApiState } from '../../apps/control-api/src/state.js';
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

describe('Live Autonomous Security Handoff Workflow (Engineering Code Artifact -> Security Work Package -> security.review -> SecurityReport -> Security Gate)', () => {
  let isNatsAlive = false;
  let isLlmAlive = false;
  let fabric: MessageFabricClient | undefined;
  let fixtureRoot: string;

  beforeAll(async () => {
    try {
      fabric = await createMessageFabric({
        servers: 'nats://localhost:4222',
        producer: 'live-sec-handoff-fabric',
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
    'executes autonomous engineering delivery, hands off Code artifact diff to security.review, seals SecurityReport, and approves Security gate with real security audit',
    async () => {
      if (!isNatsAlive || !isLlmAlive) {
        console.warn('Skipping Live Autonomous Security Handoff test: NATS or LM Studio is offline');
        return;
      }

      // 1. Create real target project fixture with PHPUnit and package.json
      fixtureRoot = await mkdtemp(join(tmpdir(), 'umer-live-sec-handoff-'));
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
            name: 'umer/autonomous-sec-fixture',
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
      await writeFile(
        join(fixtureRoot, 'package.json'),
        JSON.stringify(
          {
            name: 'umer-live-sec-node-manifest',
            version: '1.0.0',
            private: true,
            dependencies: {
              minimist: '0.0.8',
            },
          },
          null,
          2,
        ),
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
        console.warn('Skipping live autonomous Security test: composer install failed', composerInstall.stderr);
        return;
      }

      // Verify baseline test passes
      const baselineRun = await runCommand(
        process.platform === 'win32' ? 'vendor\\bin\\phpunit' : './vendor/bin/phpunit',
        [],
        fixtureRoot,
      );
      expect(baselineRun.code, 'Baseline PHPUnit suite must pass').toBe(0);

      // Initialize git
      await runCommand('git', ['init'], fixtureRoot);
      await runCommand('git', ['config', 'user.email', 'test@umer.ai'], fixtureRoot);
      await runCommand('git', ['config', 'user.name', 'Umer Autonomous Test'], fixtureRoot);
      await runCommand('git', ['add', '.'], fixtureRoot);
      await runCommand('git', ['commit', '-m', 'Initial fixture commit'], fixtureRoot);

      // 2. Setup Agent Worker with LLM CodeProducer & Security Tools
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
      const secSpec = await loadSpecFromFile(join(repoRoot, 'specialists', 'security', 'security-review.md'));

      const registry = new InMemoryRegistryAdapter();
      await registry.register(engSpec.binding);
      await registry.register(secSpec.binding);

      const toolRegistry = createToolRegistry();
      toolRegistry.register(createFilesystemReadTool());
      toolRegistry.register(createFilesystemListTool());
      toolRegistry.register(createFilesystemWriteTool());
      toolRegistry.register(createProcessRecommendTool());
      toolRegistry.register(createProcessRunAuditTool());
      const toolRouter = createToolRouter({ registry: toolRegistry });

      const { engine: artifactEngine, store: artifactStore } = createArtifactStack();
      const runStore = new InMemoryAgentRunReadModelStore();
      const runSubDurable = `sec-handoff-run-sub-${Date.now()}`;
      const sub = await subscribeAgentRunReadModel(fabric!, runStore, { durable: runSubDurable });

      const workerServiceName = `sec-handoff-worker-${Date.now()}`;
      const agentWorker = createAgentWorker({
        runtime: createAgentRuntime({
          resolveMandate: async (id) => {
            if (id === engSpec.binding.specialistId) return { mandate: engSpec.mandate, binding: engSpec.binding };
            if (id === secSpec.binding.specialistId) return { mandate: secSpec.mandate, binding: secSpec.binding };
            return undefined;
          },
          events: createMessageFabricAgentEventPublisher(fabric!, workerServiceName),
          codeProducer,
          llm: {
            provider: llmProvider,
            toolRegistry,
            toolRouter,
            maxIterations: 8,
            runTimeoutMs: 300000,
            temperature: 0.1,
            maxTokens: 2048,
          },
        }),
        fabric: fabric!,
        producer: workerServiceName,
        durablePrefix: workerServiceName,
        artifactEngine,
        resolveAgentDisplay: (specialistId) => {
          if (specialistId === engSpec.binding.specialistId) {
            return { name: 'Application Delivery Specialist', department: 'Engineering', capabilityIds: ['cap.eng.delivery'] };
          }
          return { name: 'Security Review Specialist', department: 'Security', capabilityIds: ['cap.security.review'] };
        },
        deliverPolicy: DeliverPolicy.New,
      });

      await agentWorker.start();

      // 3. Dispatch Engineering Work Package to implement multiply()
      const engWpId = `wp-eng-sec-demo-${Date.now()}`;
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
            projectId: 'proj-sec-handoff',
            targetFiles: 'Math.php,tests/MathTest.php',
          },
        },
        kind: 'work_package',
        workPackageId: engWpId,
        execId: 'EXEC-908',
        stage: 'Implementation',
        status: 'Dispatched',
        specialistId: engSpec.binding.specialistId,
        specialistSpecVersion: engSpec.binding.specVersion,
        specialistSpecHash: engSpec.binding.specHash,
        taskIds: ['task-eng-sec-1'],
        capabilityIds: engSpec.mandate.contract.capabilityIds,
        contextHandle: `ctx-eng-sec-${Date.now()}`,
        toolAllowlist: engSpec.mandate.contract.toolAllowlist,
        resourceEnvelope: { parallelism: 1 },
        targetPath: fixtureRoot,
        attempt: 1,
      });

      await fabric!.publishCommand(
        SUBJECTS.CMD_AGENT_DISPATCH,
        createCommandEnvelope({
          name: 'workpackage.dispatch',
          producer: 'handoff-coordinator',
          correlationId: `corr-eng-${Date.now()}`,
          payload: { workPackage: engWorkPackage, projectId: 'proj-sec-handoff' },
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

      // 4. CEO Approves Engineering Gate Pass -> Applies Code to Workspace
      const projectRegistry = {
        requireActive: () => ({
          projectId: 'proj-sec-handoff',
          name: 'Security Handoff Project',
          slug: 'sec-handoff',
          path: fixtureRoot,
          absolutePath: fixtureRoot,
          status: 'active' as const,
          category: 'digital-product' as const,
          stack: ['php', 'node'],
          defaultSpecialists: ['eng.app-delivery', 'security.review'],
          constraints: [],
          tags: [],
          autoApplyEng: false,
          onDisk: true,
          qaTestCommand: process.platform === 'win32' ? 'vendor\\bin\\phpunit' : './vendor/bin/phpunit',
        }),
        get: () => ({
          projectId: 'proj-sec-handoff',
          name: 'Security Handoff Project',
          slug: 'sec-handoff',
          path: fixtureRoot,
          absolutePath: fixtureRoot,
          status: 'active' as const,
          category: 'digital-product' as const,
          stack: ['php', 'node'],
          defaultSpecialists: ['eng.app-delivery', 'security.review'],
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
            execId: 'EXEC-908',
            status: 'AwaitingReview',
            specialistId: 'eng.app-delivery',
            stage: 'Implementation',
            projectId: 'proj-sec-handoff',
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
        rationale: 'Approved engineering implementation for Security handoff',
        approver: 'ceo.operator',
      });

      expect(engApply, 'Engineering gate pass must apply code to target project').toBeDefined();
      expect(engApply?.diffApplied).toBe(true);

      const modifiedMath = await readFile(join(fixtureRoot, 'Math.php'), 'utf8');
      expect(modifiedMath).toContain('multiply');

      // 5. Autonomous Security Handoff: Dispatch Security Work Package Grounded with Code Diff
      const engAnnotations = (codeArtifact.metadata?.annotations ?? {}) as Record<string, string>;
      const secWpId = `wp-sec-handoff-${Date.now()}`;
      const secInstruction =
        `Audit security for the new implementation and project files in proj-sec-handoff.\n\n` +
        `Preceding Implementation Artifact: ${codeArtifact.artifactId}\n` +
        `Files Changed: ${engAnnotations.filesChanged} file(s)\n` +
        `Staged Tests Status: testsRan=${engAnnotations.testsRan}, testsPassed=${engAnnotations.testsPassed}\n` +
        `Implementation Diff:\n\`\`\`diff\n${engAnnotations.proposedDiff}\n\`\`\`\n\n` +
        `Inspect the repository dependencies and files using process_run_audit for npm advisories, and provide your final security assessment and findings.`;

      const secWorkPackage = parseContract(WorkPackageContractSchema, {
        id: `pkg-${secWpId}`,
        schemaVersion: SCHEMA_VERSION,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {
          labels: { stage: 'security' },
          annotations: {
            instruction: secInstruction,
            projectId: 'proj-sec-handoff',
            precedingArtifactId: codeArtifact.artifactId,
          },
        },
        kind: 'work_package',
        workPackageId: secWpId,
        execId: 'EXEC-909',
        stage: 'Security',
        status: 'Dispatched',
        specialistId: secSpec.binding.specialistId,
        specialistSpecVersion: secSpec.binding.specVersion,
        specialistSpecHash: secSpec.binding.specHash,
        taskIds: ['task-sec-handoff-1'],
        capabilityIds: secSpec.mandate.contract.capabilityIds,
        contextHandle: `ctx-sec-handoff-${Date.now()}`,
        toolAllowlist: secSpec.mandate.contract.toolAllowlist,
        resourceEnvelope: { parallelism: 1 },
        targetPath: fixtureRoot,
        attempt: 1,
      });

      await fabric!.publishCommand(
        SUBJECTS.CMD_AGENT_DISPATCH,
        createCommandEnvelope({
          name: 'workpackage.dispatch',
          producer: 'handoff-coordinator',
          correlationId: `corr-sec-${Date.now()}`,
          payload: { workPackage: secWorkPackage, projectId: 'proj-sec-handoff' },
        }),
      );

      // Wait for SecurityReport artifact
      let secArtifact: any = null;
      const expectedSecArtifactId = `art-${secWpId}-1`;
      const t1 = Date.now();
      while (Date.now() - t1 < 240000) {
        const artifacts = await artifactStore.list();
        const found = artifacts.find((a) => a.artifactId === expectedSecArtifactId || a.producedFor === 'EXEC-909');
        if (found) {
          secArtifact = found;
          break;
        }
        await new Promise((r) => setTimeout(r, 1000));
      }

      if (!secArtifact) {
        const runs = await runStore.list();
        console.error('All stored artifacts:', await artifactStore.list());
        console.error('All agent runs:', JSON.stringify(runs, null, 2));
      }

      await agentWorker.stop();
      await sub.stop();
      await fabric!.jsm.consumers.delete(STREAMS.COMMANDS, `${workerServiceName}-dispatch`).catch(() => {});
      await fabric!.jsm.consumers.delete(STREAMS.EVENTS, runSubDurable).catch(() => {});

      expect(secArtifact, 'Security specialist must seal SecurityReport artifact').toBeDefined();
      expect(secArtifact.artifactType).toBe('SecurityReport');
      expect(secArtifact.acceptanceStatus).toBe('submitted');

      // 6. Assemble CEO Gate Review for Security
      controlState.workPackages.unshift({
        workPackageId: secWpId,
        execId: 'EXEC-909',
        status: 'AwaitingReview',
        specialistId: 'security.review',
        stage: 'Security',
        projectId: 'proj-sec-handoff',
        artifactId: secArtifact.artifactId,
      });

      const gateReview = buildGateReview({
        gate: {
          waitId: `wait-sec-${secWpId}`,
          gateId: `gate-wp-${secWpId}`,
          workPackageId: secWpId,
        },
        intakes: [],
        workPackages: controlState.workPackages,
        artifacts: [secArtifact],
        projectRegistry,
      });

      expect(gateReview, 'CEO Gate Review must be generated for Security').toBeDefined();
      expect(gateReview?.kind).toBe('findings');
      expect(gateReview?.requestedType).toBe('security');
      expect(gateReview?.headline).toContain('Security Review');
      expect(gateReview?.onApprove).toContain('Security audit evidence');

      // 7. CEO Approves Security Gate Pass -> Executes runSecurityAudit & applySecurityToProject
      const secApplyResult = await applySecurityOnGatePass(controlState, {
        workPackageId: secWpId,
        gateId: `gate-wp-${secWpId}`,
        rationale: 'CEO approved security review; seal static scan evidence',
      });

      expect(secApplyResult, 'Security gate pass must execute and return SecurityApplyResult').toBeDefined();
      expect(secApplyResult?.projectId).toBe('proj-sec-handoff');
      expect(secApplyResult?.evidenceDir).toBeDefined();

      // Verify that real evidence files were written to disk
      const runDir = join(fixtureRoot, secApplyResult!.evidenceDir);
      const findingsMd = await readFile(join(runDir, 'FINDINGS.md'), 'utf8');
      expect(findingsMd).toContain('Security audit — Security Handoff Project');

      const lastApplyJson = await readFile(join(runDir, 'last-apply.json'), 'utf8');
      expect(lastApplyJson).toContain('security.review');

      const applyReportMd = await readFile(join(runDir, 'APPLY_REPORT.md'), 'utf8');
      expect(applyReportMd).toContain('Security apply report');
    },
    360000,
  );
});
