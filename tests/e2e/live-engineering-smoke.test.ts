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
  SUBJECTS,
  createCommandEnvelope,
  DeliverPolicy,
} from '@umer/message-fabric';
import {
  createAgentRuntime,
  createAgentWorker,
  createMessageFabricAgentEventPublisher,
  subscribeAgentRunReadModel,
} from '@umer/agent-runtime';
import { InMemoryAgentRunReadModelStore } from '../../packages/observability/src/index.js';
import { createScriptedCodeProducer, type EngChangeSetEntry } from '../../packages/registry/src/index.js';

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

function runCommand(command: string, args: string[], cwd: string): Promise<{ code: number | null; stdout: string; stderr: string }> {
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
 * Live proof of the Engineering delivery pipeline — the real mechanical path,
 * not a unit-level function call:
 *
 *   Implementation Work Package -> NATS dispatch -> Agent Worker -> Agent
 *   Runtime -> real repository inspection of a disposable fixture repo ->
 *   isolated staging workspace -> real file mutation -> real PHPUnit
 *   execution -> real unified diff -> sealed Code artifact (submitted,
 *   awaiting the human/CEO review gate) -> real Agent Run.
 *
 * eng.app-delivery is a deterministic specialist (packages/agent-runtime/src/
 * runtime.ts: DETERMINISTIC_SPECIALISTS) — it never invents code itself
 * (packages/registry/src/eng-diff.ts: "There is no LLM code generator in
 * this deterministic registry"). This repo currently ships exactly one
 * CodeProducer, `manual.human-change-set`, which declines to write anything
 * (apps/control-api/src/code-producer.ts). So this test uses
 * `createScriptedCodeProducer` — a deterministic adapter that reads the
 * fixture's REAL current file bytes via `readProjectFile` (real repository
 * inspection) and returns an explicit, reviewable change-set. This is
 * honest: it proves the staging/diff/test/artifact/gate machinery for real,
 * without claiming an LLM authored the change (none is wired in yet — see
 * AUTONOMY_STATUS.md).
 *
 * The fixture is a minimal PHPUnit project, not a plain `npm test` script:
 * packages/registry/src/qa-run.ts's `isAllowedQaCommand` allowlist only
 * executes PHPUnit/Pest/Composer-test/Playwright commands — a bare `npm
 * test` is never invoked by the real staged test runner. PHPUnit is the
 * actual, currently-supported test runner for eng.app-delivery, matching
 * this system's real (Laravel/PHP) catalog projects.
 */
describe('Live Engineering Delivery Smoke Test (NATS + isolated staging + real PHPUnit)', () => {
  let isNatsAlive = false;
  let fixtureRoot = '';

  beforeAll(async () => {
    try {
      await createMessageFabric({ servers: 'nats://localhost:4222', ensureInfrastructure: false });
      isNatsAlive = true;
    } catch {
      isNatsAlive = false;
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
    'delivers a real feature change through NATS -> Agent Worker -> isolated staging -> real PHPUnit -> sealed artifact, leaving the source fixture untouched pending gate approval',
    async () => {
      if (!isNatsAlive) {
        console.warn('Skipping live engineering delivery test: NATS not responsive');
        return;
      }

      // 1. A disposable PHPUnit fixture repository — never the umer-ai-os
      //    repo itself, and never a real Laragon client project.
      fixtureRoot = await mkdtemp(join(tmpdir(), 'umer-eng-fixture-'));
      const baselineMath = '<?php\n\nclass Math\n{\n    public static function add($a, $b)\n    {\n        return $a + $b;\n    }\n}\n';
      const baselineTest =
        "<?php\n\nuse PHPUnit\\Framework\\TestCase;\nrequire_once __DIR__ . '/../Math.php';\n\nclass MathTest extends TestCase\n{\n    public function testAdd()\n    {\n        $this->assertEquals(5, Math::add(2, 3));\n    }\n}\n";
      await writeFile(
        join(fixtureRoot, 'composer.json'),
        JSON.stringify({ name: 'umer/disposable-eng-fixture', 'require-dev': { 'phpunit/phpunit': '^11' } }, null, 2),
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

      const composerInstall = await runCommand('composer', ['install', '--no-interaction', '--quiet'], fixtureRoot);
      if (composerInstall.code !== 0) {
        console.warn('Skipping live engineering delivery test: composer install failed', composerInstall.stderr);
        return;
      }

      // 2. A deterministic code producer that INSPECTS the real staged files
      //    (via readProjectFile) before authoring its change-set — proving
      //    real repository inspection, not a blind overwrite.
      const codeProducer = createScriptedCodeProducer({
        id: 'test.scripted-add-multiply',
        description: 'Deterministic test producer: adds multiply() and its PHPUnit coverage',
        changes: async (request): Promise<EngChangeSetEntry[]> => {
          const currentMath = await request.readProjectFile('Math.php');
          const currentTest = await request.readProjectFile('tests/MathTest.php');
          if (currentMath === null || currentTest === null) return [];
          // Insert the new method before the CLASS's closing brace (the last
          // one in the file) — a naive first-match .replace('}\n', ...)
          // would instead land on the add() method's own closing brace.
          const insertBeforeLastBrace = (source: string, methodBody: string): string => {
            const lastBrace = source.lastIndexOf('}');
            return `${source.slice(0, lastBrace)}\n${methodBody}${source.slice(lastBrace)}`;
          };
          const newMath = insertBeforeLastBrace(
            currentMath,
            '    public static function multiply($a, $b)\n    {\n        return $a * $b;\n    }\n',
          );
          const newTest = insertBeforeLastBrace(
            currentTest,
            '    public function testMultiply()\n    {\n        $this->assertEquals(6, Math::multiply(2, 3));\n    }\n',
          );
          return [
            { path: 'Math.php', expectedContent: currentMath, content: newMath, note: 'Add multiply()' },
            { path: 'tests/MathTest.php', expectedContent: currentTest, content: newTest, note: 'Cover multiply() with a real PHPUnit assertion' },
          ];
        },
      });

      // 3. Real NATS dispatch through a real Agent Worker running the real
      //    (deterministic) engineering handler — same shape as
      //    live-runtime-smoke.test.ts's LLM path, minus the `llm` option
      //    (eng.app-delivery never reaches AgentRuntime's LLM branch).
      const testFabric = await createMessageFabric({
        servers: 'nats://localhost:4222',
        producer: 'eng-smoke-test-fabric',
      });

      const specPath = join(repoRoot, 'specialists', 'engineering', 'application-delivery.md');
      const loadedSpec = await loadSpecFromFile(specPath);
      const registry = new InMemoryRegistryAdapter();
      await registry.register(loadedSpec.binding);

      const { engine: artifactEngine, store: artifactStore } = createArtifactStack();
      const runStore = new InMemoryAgentRunReadModelStore();
      const sub = await subscribeAgentRunReadModel(testFabric, runStore, {
        durable: `eng-smoke-run-sub-${Date.now()}`,
      });

      const workerServiceName = `eng-smoke-worker-${Date.now()}`;
      const agentWorker = createAgentWorker({
        runtime: createAgentRuntime({
          resolveMandate: async (id) =>
            id === loadedSpec.binding.specialistId ? { mandate: loadedSpec.mandate, binding: loadedSpec.binding } : undefined,
          events: createMessageFabricAgentEventPublisher(testFabric, workerServiceName),
          codeProducer,
        }),
        fabric: testFabric,
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

      const correlationId = `corr-eng-smoke-${Date.now()}`;
      const workPackageId = `wp-eng-smoke-${Date.now()}`;
      const instruction = 'Add a multiply(a, b) method to Math.php with real PHPUnit coverage, matching the existing add() convention.';

      const workPackage = parseContract(WorkPackageContractSchema, {
        id: `pkg-${workPackageId}`,
        schemaVersion: SCHEMA_VERSION,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {
          labels: { environment: 'smoke' },
          annotations: { instruction, projectId: 'proj-eng-smoke-fixture' },
        },
        kind: 'work_package',
        workPackageId,
        execId: 'EXEC-902',
        stage: 'Implementation',
        status: 'Dispatched',
        specialistId: loadedSpec.binding.specialistId,
        specialistSpecVersion: loadedSpec.binding.specVersion,
        specialistSpecHash: loadedSpec.binding.specHash,
        taskIds: ['task-eng-smoke-1'],
        capabilityIds: loadedSpec.mandate.contract.capabilityIds,
        contextHandle: `ctx-eng-smoke-${Date.now()}`,
        toolAllowlist: loadedSpec.mandate.contract.toolAllowlist,
        resourceEnvelope: { parallelism: 1 },
        targetPath: fixtureRoot,
        attempt: 1,
      });

      const dispatchCmd = createCommandEnvelope({
        name: 'workpackage.dispatch',
        producer: 'eng-smoke-test-coordinator',
        correlationId,
        payload: { workPackage, projectId: 'proj-eng-smoke-fixture' },
      });

      await testFabric.publishCommand(SUBJECTS.CMD_AGENT_DISPATCH, dispatchCmd);

      // 4. Wait for the real sealed artifact.
      let sealedArtifact: any = null;
      const startTime = Date.now();
      const timeoutMs = 60000;
      while (Date.now() - startTime < timeoutMs) {
        const artifacts = await artifactStore.list();
        const match = artifacts.find((a) => a.producedFor === workPackage.execId);
        if (match) {
          sealedArtifact = match;
          break;
        }
        await new Promise((r) => setTimeout(r, 1000));
      }

      await agentWorker.stop();
      await sub.stop();

      // 5. Real evidence assertions — a real diff, real PHPUnit execution, real seal.
      expect(sealedArtifact, 'A Code artifact should have been sealed by the live delivery run').toBeDefined();
      expect(sealedArtifact.artifactType).toBe('Code');
      expect(sealedArtifact.acceptanceStatus).toBe('submitted');
      expect(sealedArtifact.contentHash).toBeTruthy();

      const annotations = sealedArtifact.metadata.annotations as Record<string, string>;
      expect(annotations.filesChanged).toBe('2');
      expect(annotations.testsRan, `staged PHPUnit run must have actually run; diff was:\n${annotations.proposedDiff}`).toBe('true');
      expect(annotations.testsPassed, `staged PHPUnit run must have actually passed; diff was:\n${annotations.proposedDiff}`).toBe('true');
      expect(annotations.proposedDiff).toContain('multiply');
      expect(annotations.proposedDiff).toContain('Math.php');
      expect(annotations.proposedDiff).toContain('MathTest.php');

      // 6. Verify the Agent Run was projected into the read model.
      const runs = await runStore.list();
      const run = runs.find((r) => r.workPackageId === workPackageId);
      expect(run).toBeDefined();
      expect(run?.status).toBe('completed');

      // 7. Isolation proof: the SOURCE fixture (not staging) must remain the
      //    baseline — eng.app-delivery only ever writes inside an isolated
      //    staging copy; the real project tree changes only after a human
      //    gate Pass runs the separate apply step.
      const sourceMathAfterRun = await readFile(join(fixtureRoot, 'Math.php'), 'utf8');
      expect(sourceMathAfterRun).toBe(baselineMath);
      expect(sourceMathAfterRun).not.toContain('multiply');
    },
    180000,
  );
});
