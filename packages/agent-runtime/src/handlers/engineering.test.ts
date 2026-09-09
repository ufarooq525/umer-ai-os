import { describe, expect, it } from 'vitest';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { parseContract, SCHEMA_VERSION, WorkPackageContractSchema } from '@umer/contracts';
import { loadSpecFromString } from '@umer/specialist-sdk';
import { runEngineeringApplicationDelivery } from './engineering.js';

async function loadEngineeringSpec(): Promise<string> {
  const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..', '..');
  return readFile(join(root, 'specialists', 'engineering', 'application-delivery.md'), 'utf8');
}

function makeWorkPackage(
  specHash: string,
  overrides: {
    taskIds?: string[];
    targetPath?: string;
    annotations?: Record<string, string>;
  } = {},
) {
  return parseContract(WorkPackageContractSchema, {
    id: 'wp-hdr',
    schemaVersion: SCHEMA_VERSION,
    createdAt: '2026-09-06T00:00:00.000Z',
    updatedAt: '2026-09-06T00:00:00.000Z',
    metadata: { labels: {}, annotations: overrides.annotations ?? {} },
    kind: 'work_package',
    workPackageId: 'wp-1',
    execId: 'EXEC-001',
    stage: 'Development',
    status: 'Dispatched',
    specialistId: 'eng.app-delivery',
    specialistSpecVersion: '1.0.0',
    specialistSpecHash: specHash,
    taskIds: overrides.taskIds ?? ['task-1'],
    capabilityIds: ['cap.app.delivery'],
    contextHandle: 'ctx-1',
    toolAllowlist: ['git.diff'],
    resourceEnvelope: { parallelism: 1 },
    attempt: 1,
    ...(overrides.targetPath ? { targetPath: overrides.targetPath } : {}),
  });
}

describe('runEngineeringApplicationDelivery', () => {
  describe('ungrounded or missing change-set (honest fallback)', () => {
    it('never claims a criterion is VERIFIED when no change-set was supplied', async () => {
      const loaded = loadSpecFromString(await loadEngineeringSpec());
      const workPackage = makeWorkPackage(loaded.mandate.specHash);

      const result = await runEngineeringApplicationDelivery(workPackage, loaded.mandate);

      expect(result.artifact.acceptanceStatus).not.toBe('submitted');
      expect(result.artifact.acceptanceStatus).not.toBe('accepted');
      for (const criterion of result.artifact.acceptanceCriteriaMet) {
        expect(criterion.status).not.toBe('VERIFIED');
      }
    });

    it('reports draft/N_A honestly, one criterion per real task id, and no invented evidenceRef', async () => {
      const loaded = loadSpecFromString(await loadEngineeringSpec());
      const workPackage = makeWorkPackage(loaded.mandate.specHash, { taskIds: ['task-1', 'task-2'] });

      const result = await runEngineeringApplicationDelivery(workPackage, loaded.mandate);

      expect(result.artifact.acceptanceStatus).toBe('draft');
      expect(result.artifact.acceptanceCriteriaMet).toEqual([
        { criterion: 'Task task-1 delivery evidence', status: 'N_A' },
        { criterion: 'Task task-2 delivery evidence', status: 'N_A' },
      ]);
    });

    it('says in its summary that manual scoping is needed, not that delivery completed', async () => {
      const loaded = loadSpecFromString(await loadEngineeringSpec());
      const workPackage = makeWorkPackage(loaded.mandate.specHash);

      const result = await runEngineeringApplicationDelivery(workPackage, loaded.mandate);

      expect(result.summary).toContain('needs manual scoping');
      expect(result.summary).not.toContain('completed');
    });

    it('still produces a valid, sealable Code artifact', async () => {
      const loaded = loadSpecFromString(await loadEngineeringSpec());
      const workPackage = makeWorkPackage(loaded.mandate.specHash);

      const result = await runEngineeringApplicationDelivery(workPackage, loaded.mandate);

      expect(result.artifact.artifactType).toBe('Code');
      expect(result.artifact.sourceTaskId).toBe('task-1');
      expect(result.artifact.producedFor).toBe(workPackage.execId);
    });
  });

  describe('grounded delivery execution (real staging & diff evidence)', () => {
    it('produces submitted Code artifact with VERIFIED status when staging delivery succeeds', async () => {
      const loaded = loadSpecFromString(await loadEngineeringSpec());
      const workPackage = makeWorkPackage(loaded.mandate.specHash, {
        targetPath: '/mock/repo',
        annotations: {
          changeSet: JSON.stringify([
            { path: 'src/index.ts', oldContent: 'export const a = 1;', newContent: 'export const a = 2;' },
          ]),
        },
      });

      const mockRunner = async () => ({
        status: 'ready' as const,
        runId: 'eng-wp-1-1',
        project: {
          projectId: 'EXEC-001',
          name: 'EXEC-001',
          slug: 'exec-001',
          path: '/mock/repo',
          absolutePath: '/mock/repo',
          status: 'active' as const,
          category: 'digital-product' as const,
          stack: [],
          defaultSpecialists: ['eng.app-delivery'],
          constraints: [],
          tags: [],
          autoApplyEng: false,
          onDisk: true,
        },
        proposedDiff: '--- src/index.ts\n+++ src/index.ts\n@@ -1 +1 @@\n-export const a = 1;\n+export const a = 2;\n',
        editStats: { filesChanged: 1, linesAdded: 1, linesRemoved: 1 },
        stagedEvidence: {
          stagingRoot: '/tmp/staging',
          testOutput: 'All 5 tests passed',
          lintOutput: '',
          typecheckOutput: '',
        },
        testsRan: 5,
        testsPassed: true,
      });

      const result = await runEngineeringApplicationDelivery(workPackage, loaded.mandate, {
        deliveryRunner: mockRunner,
      });

      expect(result.artifact.acceptanceStatus).toBe('submitted');
      expect(result.artifact.artifactType).toBe('Code');
      expect(result.artifact.acceptanceCriteriaMet).toEqual([
        {
          criterion: 'Controlled repository diff (1 file(s) changed, +1/-1)',
          status: 'VERIFIED',
          evidenceRef: 'diff://eng-wp-1-1',
        },
        {
          criterion: 'Staged test execution (testsRan=5, testsPassed=true)',
          status: 'VERIFIED',
          evidenceRef: 'test-evidence://eng-wp-1-1',
        },
        {
          criterion: 'Task task-1 delivery evidence',
          status: 'VERIFIED',
          evidenceRef: 'task-evidence://task-1/eng-wp-1-1',
        },
      ]);
      expect(result.summary).toContain('Implementation completed for wp-1: 1 file(s) changed (+1/-1)');
      expect(result.summary).toContain('Awaiting human review gate');
      expect(result.artifact.contentRef).toBe('file://eng-wp-1-1/PROPOSED_DIFF.patch');
    });

    it('marks test criteria as FAILED when staged tests fail', async () => {
      const loaded = loadSpecFromString(await loadEngineeringSpec());
      const workPackage = makeWorkPackage(loaded.mandate.specHash, {
        targetPath: '/mock/repo',
        annotations: {
          changeSet: JSON.stringify([
            { path: 'src/index.ts', oldContent: 'export const a = 1;', newContent: 'export const a = 2;' },
          ]),
        },
      });

      const mockRunner = async () => ({
        status: 'ready' as const,
        runId: 'eng-wp-1-1',
        project: {
          projectId: 'EXEC-001',
          name: 'EXEC-001',
          slug: 'exec-001',
          path: '/mock/repo',
          absolutePath: '/mock/repo',
          status: 'active' as const,
          category: 'digital-product' as const,
          stack: [],
          defaultSpecialists: ['eng.app-delivery'],
          constraints: [],
          tags: [],
          autoApplyEng: false,
          onDisk: true,
        },
        proposedDiff: '--- src/index.ts\n+++ src/index.ts\n@@ -1 +1 @@\n-export const a = 1;\n+export const a = 2;\n',
        editStats: { filesChanged: 1, linesAdded: 1, linesRemoved: 1 },
        stagedEvidence: {
          stagingRoot: '/tmp/staging',
          testOutput: '1 test failed',
          lintOutput: '',
          typecheckOutput: '',
        },
        testsRan: 2,
        testsPassed: false,
      });

      const result = await runEngineeringApplicationDelivery(workPackage, loaded.mandate, {
        deliveryRunner: mockRunner,
      });

      expect(result.artifact.acceptanceCriteriaMet).toEqual([
        {
          criterion: 'Controlled repository diff (1 file(s) changed, +1/-1)',
          status: 'VERIFIED',
          evidenceRef: 'diff://eng-wp-1-1',
        },
        {
          criterion: 'Staged test execution (testsRan=2, testsPassed=false)',
          status: 'FAILED',
          evidenceRef: 'test-evidence://eng-wp-1-1',
        },
        {
          criterion: 'Task task-1 delivery evidence',
          status: 'FAILED',
          evidenceRef: 'task-evidence://task-1/eng-wp-1-1',
        },
      ]);
    });

    it('executes real isolated staging with actual runEngDelivery without mutating target project', async () => {
      const tempProjectDir = await mkdtemp(join(tmpdir(), 'm5-eng-test-'));
      try {
        const testFilePath = join(tempProjectDir, 'index.ts');
        await writeFile(testFilePath, 'initial content\n', 'utf8');

        const loaded = loadSpecFromString(await loadEngineeringSpec());
        const workPackage = makeWorkPackage(loaded.mandate.specHash, {
          targetPath: tempProjectDir,
          annotations: {
            changeSet: JSON.stringify([
              {
                path: 'index.ts',
                expectedContent: 'initial content\n',
                content: 'initial content\nnew line added\n',
              },
            ]),
          },
        });

        // Run with the real default runEngDelivery pipeline
        const result = await runEngineeringApplicationDelivery(workPackage, loaded.mandate);

        expect(result.artifact.acceptanceStatus).toBe('submitted');
        expect(result.artifact.acceptanceCriteriaMet[0].status).toBe('VERIFIED');
        expect(result.artifact.metadata.annotations?.filesChanged).toBe('1');
        expect(result.artifact.metadata.annotations?.linesAdded).toBe('1');
        expect(result.artifact.metadata.annotations?.proposedDiff).toContain('+new line added');

        // Verify the original project file is UNTOUCHED (isolated staging guarantee)
        const currentFileContent = await readFile(testFilePath, 'utf8');
        expect(currentFileContent).toBe('initial content\n');
      } finally {
        await rm(tempProjectDir, { recursive: true, force: true });
      }
    });
  });
});

