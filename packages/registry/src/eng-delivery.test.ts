import { afterEach, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { runEngDelivery, evaluateStagedRuns, captureStagedEvidence } from './eng-delivery.js';
import { applyEngToProject } from './eng-apply.js';
import {
  resolveEngScope,
  assertSafeEngRunId,
  assertNoSymlinkInProjectPath,
} from './eng-scope.js';
import { contentHash } from './eng-diff.js';
import { decideEngGate, evaluateEngAutoEligibility } from './eng-gate-policy.js';
import { ProjectRegistryError } from './errors.js';
import { ProjectRecordSchema } from './schema.js';
import { planIntake, planIntakeWithEng } from './intake.js';
import { createProjectRegistry } from './registry.js';
import type { EngChangeSetEntry } from './eng-diff.js';
import type { ResolvedProject } from './types.js';
import type { QaRunBundle } from './qa-run.js';

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');
const catalogPath = join(repoRoot, 'projects', 'catalog.json');

function fakeProject(overrides: Partial<ResolvedProject> = {}): ResolvedProject {
  return {
    projectId: 'demo',
    name: 'Demo',
    slug: 'demo',
    path: 'demo',
    status: 'active',
    category: 'client-task',
    stack: ['fullstack'],
    defaultSpecialists: ['eng.app-delivery'],
    constraints: [],
    tags: [],
    absolutePath: '/tmp/demo',
    autoApplyEng: false,
    ...overrides,
  };
}

function humanApproval(overrides: Partial<{ gateId: string; approver: string; rationale: string }> = {}) {
  return {
    kind: 'human-gate' as const,
    gateId: 'gate-eng-demo',
    approver: 'human.approver',
    rationale: 'test eng apply',
    ...overrides,
  };
}

const CONTROLLER_REL = 'app/Http/Controllers/FeeController.php';

const CONTROLLER = [
  '<?php',
  '',
  'class FeeController',
  '{',
  '    public function store(Request $request)',
  '    {',
  '        $data = $request->all();',
  '        return Fee::create($data);',
  '    }',
  '}',
  '',
].join('\n');

const CONTROLLER_FIXED = CONTROLLER.replace(
  '        $data = $request->all();',
  "        $data = $request->validate(['amount' => 'required|numeric']);",
);

function validationChange(overrides: Partial<EngChangeSetEntry> = {}): EngChangeSetEntry {
  return {
    path: CONTROLLER_REL,
    expectedContent: CONTROLLER,
    expectedHash: contentHash(CONTROLLER),
    content: CONTROLLER_FIXED,
    note: 'Validate the fee payload instead of trusting request->all()',
    ...overrides,
  };
}

async function seedProject(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'umer-eng-'));
  await mkdir(join(dir, 'app', 'Http', 'Controllers'), { recursive: true });
  await mkdir(join(dir, 'app', 'Modules', 'Fees'), { recursive: true });
  await mkdir(join(dir, 'tests', 'Feature', 'Fees'), { recursive: true });
  await writeFile(join(dir, 'phpunit.xml'), '<phpunit/>', 'utf8');
  await writeFile(join(dir, 'app', 'Modules', 'Fees', 'FeeService.php'), '<?php', 'utf8');
  await writeFile(join(dir, CONTROLLER_REL), CONTROLLER, 'utf8');
  return dir;
}

afterEach(() => {
  delete process.env.UMER_QA_SKIP_RUN;
});

describe('eng scope guard', () => {
  it('flags changes wider than the file limit for manual scoping', async () => {
    const dir = await seedProject();
    try {
      const scope = await resolveEngScope({
        root: dir,
        targetFiles: ['a.php', 'b.php', 'c.php', 'd.php'],
      });
      expect(scope.status).toBe('needs-manual-scoping');
      expect(scope.fileCount).toBe(4);
      expect(scope.reasons.join(' ')).toContain('limit 3');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('expands a named module into its member files', async () => {
    const dir = await seedProject();
    try {
      const scope = await resolveEngScope({ root: dir, targetModule: 'Fees' });
      expect(scope.moduleDir).toBe('app/Modules/Fees');
      expect(scope.files.map((f) => f.path)).toContain('app/Modules/Fees/FeeService.php');
      expect(scope.status).toBe('in-scope');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('rejects paths that escape the project root', async () => {
    const dir = await seedProject();
    try {
      const scope = await resolveEngScope({ root: dir, targetFiles: ['../../etc/hosts'] });
      expect(scope.status).toBe('needs-manual-scoping');
      expect(scope.reasons.join(' ')).toContain('unsafe target path');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('fail-closes to needs-manual-scoping when any safety reason is recorded', async () => {
    const dir = await seedProject();
    try {
      const scope = await resolveEngScope({
        root: dir,
        targetFiles: [CONTROLLER_REL, '../../etc/hosts'],
      });
      expect(scope.files.some((f) => f.path === CONTROLLER_REL)).toBe(true);
      expect(scope.reasons.length).toBeGreaterThan(0);
      expect(scope.status).toBe('needs-manual-scoping');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('eng.app-delivery runner', () => {
  it('produces a diff, rationale, and test plan for a single-file bug fix', async () => {
    process.env.UMER_QA_SKIP_RUN = '1';
    const dir = await seedProject();
    try {
      const report = await runEngDelivery({
        project: fakeProject({ absolutePath: dir }),
        type: 'bug',
        goal: 'Validate fee payload before creating a Fee',
        targetFiles: [CONTROLLER_REL],
        proposedChanges: [validationChange()],
        runId: 'eng-demo-test',
      });

      expect(report.status).toBe('ready');
      expect(report.blockers).toEqual([]);
      expect(report.proposedDiff).toContain(`--- a/${CONTROLLER_REL}`);
      expect(report.proposedDiff).toContain('-        $data = $request->all();');
      expect(report.proposedDiff).toContain("+        $data = $request->validate(");
      expect(report.editStats).toEqual({ filesChanged: 1, linesAdded: 1, linesRemoved: 1 });
      expect(report.rationale).toContain('Validate the fee payload');
      expect(report.testPlan.some((i) => i.id === 'eng-bug-repro')).toBe(true);
      expect(report.testPlan.some((i) => i.id === 'eng-regression-suite')).toBe(true);
      expect(report.recommendedCommand).toBe('./vendor/bin/phpunit');
      // The real project file must stay untouched until apply.
      expect(await readFile(join(dir, CONTROLLER_REL), 'utf8')).toBe(CONTROLLER);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('leaves testsPassed false when no suite could actually run', async () => {
    const dir = await seedProject();
    try {
      const report = await runEngDelivery({
        project: fakeProject({ absolutePath: dir }),
        type: 'bug',
        goal: 'Validate fee payload before creating a Fee',
        targetFiles: [CONTROLLER_REL],
        proposedChanges: [validationChange()],
        runId: 'eng-demo-noruns',
      });

      expect(report.status).toBe('ready');
      // phpunit.xml is present but vendor/bin is not, so the suite skips — fail closed.
      expect(report.testsRan).toBe(false);
      expect(report.testsPassed).toBe(false);
      expect(report.runs.every((r) => r.skipped)).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('refuses to attempt a change spanning more than three files', async () => {
    process.env.UMER_QA_SKIP_RUN = '1';
    const dir = await seedProject();
    try {
      const report = await runEngDelivery({
        project: fakeProject({ absolutePath: dir }),
        type: 'feature',
        goal: 'Rewrite the whole fees module in one shot',
        targetFiles: ['a.php', 'b.php', 'c.php', 'd.php'],
        proposedChanges: [{ path: 'a.php', expectedContent: null, content: 'x' }],
      });

      expect(report.status).toBe('needs-manual-scoping');
      expect(report.proposedDiff).toBe('');
      expect(report.edits).toEqual([]);
      expect(report.rationale).toContain('not attempted automatically');
      expect(report.blockers.join(' ')).toContain('limit 3');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('flags a stale base instead of proposing a diff against moved code', async () => {
    process.env.UMER_QA_SKIP_RUN = '1';
    const dir = await seedProject();
    try {
      const report = await runEngDelivery({
        project: fakeProject({ absolutePath: dir }),
        type: 'bug',
        goal: 'Patch a file that has already moved on',
        targetFiles: [CONTROLLER_REL],
        proposedChanges: [
          validationChange({
            expectedContent: '<?php // something else entirely',
            expectedHash: undefined,
          }),
        ],
      });

      expect(report.status).toBe('needs-manual-scoping');
      expect(report.blockers.join(' ')).toContain('Stale base content');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('flags a mismatched base hash', async () => {
    process.env.UMER_QA_SKIP_RUN = '1';
    const dir = await seedProject();
    try {
      const report = await runEngDelivery({
        project: fakeProject({ absolutePath: dir }),
        type: 'bug',
        goal: 'Patch with a hash that does not match',
        targetFiles: [CONTROLLER_REL],
        proposedChanges: [validationChange({ expectedHash: 'f'.repeat(64) })],
      });

      expect(report.status).toBe('needs-manual-scoping');
      expect(report.blockers.join(' ')).toContain('Stale base hash');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('requires an explicit change-set — it never invents code', async () => {
    process.env.UMER_QA_SKIP_RUN = '1';
    const dir = await seedProject();
    try {
      const report = await runEngDelivery({
        project: fakeProject({ absolutePath: dir }),
        type: 'feature',
        goal: 'Add fee validation but supply nothing to apply',
        targetFiles: [CONTROLLER_REL],
      });

      expect(report.status).toBe('needs-manual-scoping');
      expect(report.blockers.join(' ')).toContain('No proposedChanges supplied');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('rejects edits outside an explicitly declared target scope', async () => {
    process.env.UMER_QA_SKIP_RUN = '1';
    const dir = await seedProject();
    try {
      const report = await runEngDelivery({
        project: fakeProject({ absolutePath: dir }),
        type: 'bug',
        goal: 'Edit must stay inside declared target files',
        targetFiles: [CONTROLLER_REL],
        proposedChanges: [
          {
            path: 'app/Modules/Fees/FeeService.php',
            expectedContent: '<?php',
            content: '<?php // changed\n',
            note: 'out of scope',
          },
        ],
      });
      expect(report.status).toBe('needs-manual-scoping');
      expect(report.blockers.join(' ')).toContain('outside the declared target scope');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('applyEngToProject', () => {
  it('applies the change and seals evidence under .umer/eng/<runId>/ on gate Pass', async () => {
    process.env.UMER_QA_SKIP_RUN = '1';
    const dir = await seedProject();
    try {
      const project = fakeProject({ absolutePath: dir });
      const report = await runEngDelivery({
        project,
        type: 'feature',
        goal: 'Add a fee validation guard',
        targetFiles: [CONTROLLER_REL],
        proposedChanges: [validationChange()],
        runId: 'eng-demo-apply',
      });

      const result = await applyEngToProject({
        project,
        report,
        approval: humanApproval(),
      });

      expect(result.diffApplied).toBe(true);
      expect(result.changedFiles).toEqual([CONTROLLER_REL]);
      expect(result.evidenceDir).toBe('.umer/eng/eng-demo-apply');

      const source = await readFile(join(dir, CONTROLLER_REL), 'utf8');
      expect(source).toBe(CONTROLLER_FIXED);

      const base = join(dir, '.umer', 'eng', 'eng-demo-apply');
      const applyReport = await readFile(join(base, 'APPLY_REPORT.md'), 'utf8');
      expect(applyReport).toContain('Changed source files');
      expect(applyReport).toContain('Staged suite results');
      const patch = await readFile(join(base, 'PROPOSED_DIFF.patch'), 'utf8');
      expect(patch).toContain('diff --git');
      const planMd = await readFile(join(base, 'TEST_PLAN.md'), 'utf8');
      expect(planMd).toContain('eng-regression-suite');
      const record = JSON.parse(await readFile(join(base, 'last-apply.json'), 'utf8'));
      expect(record.specialistId).toBe('eng.app-delivery');
      expect(record.mode).toBe('human');
      expect(record.approval.kind).toBe('human-gate');
      expect(record.approval.approver).toBe('human.approver');
      expect(record.changedFiles).toEqual([CONTROLLER_REL]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('seals captured stagedEvidence files into .umer/eng/<runId>/evidence/', async () => {
    process.env.UMER_QA_SKIP_RUN = '1';
    const dir = await seedProject();
    try {
      const project = fakeProject({ absolutePath: dir });
      const report = await runEngDelivery({
        project,
        type: 'feature',
        goal: 'Seal stubbed staged evidence on apply',
        targetFiles: [CONTROLLER_REL],
        proposedChanges: [validationChange()],
        runId: 'eng-demo-evidence',
      });

      // Deterministic stub — staging may skip suites, so inject captured evidence.
      const withEvidence = {
        ...report,
        stagedEvidence: [
          { name: 'phpunit-stdout.txt', content: 'OK (1 test)\n' },
          { name: 'phpunit-run.json', content: '{"ok":true}\n' },
        ],
      };

      await applyEngToProject({
        project,
        report: withEvidence,
        approval: humanApproval({ rationale: 'seal evidence' }),
      });

      const evidenceDir = join(dir, '.umer', 'eng', 'eng-demo-evidence', 'evidence');
      expect(await readFile(join(evidenceDir, 'phpunit-stdout.txt'), 'utf8')).toContain('OK (1 test)');
      expect(await readFile(join(evidenceDir, 'phpunit-run.json'), 'utf8')).toContain('"ok":true');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('refuses to apply a package that needs manual scoping', async () => {
    process.env.UMER_QA_SKIP_RUN = '1';
    const dir = await seedProject();
    try {
      const project = fakeProject({ absolutePath: dir });
      const report = await runEngDelivery({
        project,
        type: 'feature',
        goal: 'Way too broad to attempt automatically',
        targetFiles: ['a.php', 'b.php', 'c.php', 'd.php'],
      });

      await expect(
        applyEngToProject({ project, report, approval: humanApproval({ rationale: 'nope' }) }),
      ).rejects.toThrow(ProjectRegistryError);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('refuses human apply without gateId/approver', async () => {
    process.env.UMER_QA_SKIP_RUN = '1';
    const dir = await seedProject();
    try {
      const project = fakeProject({ absolutePath: dir });
      const report = await runEngDelivery({
        project,
        type: 'bug',
        goal: 'Validate fee payload before creating a Fee',
        targetFiles: [CONTROLLER_REL],
        proposedChanges: [validationChange()],
        runId: 'eng-demo-no-approver',
      });

      await expect(
        applyEngToProject({
          project,
          report,
          approval: humanApproval({ gateId: '  ', approver: '' }),
        }),
      ).rejects.toThrow(/gateId|approver/i);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('refuses to apply once the target file has moved on', async () => {
    process.env.UMER_QA_SKIP_RUN = '1';
    const dir = await seedProject();
    try {
      const project = fakeProject({ absolutePath: dir });
      const report = await runEngDelivery({
        project,
        type: 'bug',
        goal: 'Validate fee payload before creating a Fee',
        targetFiles: [CONTROLLER_REL],
        proposedChanges: [validationChange()],
        runId: 'eng-demo-stale',
      });

      await writeFile(join(dir, CONTROLLER_REL), `${CONTROLLER}\n// edited by someone else\n`, 'utf8');

      await expect(
        applyEngToProject({
          project,
          report,
          approval: humanApproval({ rationale: 'stale' }),
        }),
      ).rejects.toThrow(/Stale base/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('never auto-applies for a client-task project, even with autoApplyEng set', async () => {
    process.env.UMER_QA_SKIP_RUN = '1';
    const dir = await seedProject();
    try {
      const project = fakeProject({
        absolutePath: dir,
        category: 'client-task',
        autoApplyEng: true,
      });
      const report = await runEngDelivery({
        project,
        type: 'bug',
        goal: 'Validate fee payload before creating a Fee',
        targetFiles: [CONTROLLER_REL],
        proposedChanges: [validationChange()],
        runId: 'eng-demo-auto-blocked',
      });

      await expect(
        applyEngToProject({
          project,
          report,
          approval: { kind: 'auto', reason: 'should not work' },
        }),
      ).rejects.toThrow(/client-task/);
      expect(await readFile(join(dir, CONTROLLER_REL), 'utf8')).toBe(CONTROLLER);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('rejects unsafe runId path traversal', async () => {
    process.env.UMER_QA_SKIP_RUN = '1';
    const dir = await seedProject();
    try {
      const project = fakeProject({ absolutePath: dir });
      await expect(
        runEngDelivery({
          project,
          type: 'bug',
          goal: 'Unsafe run id must be rejected',
          targetFiles: [CONTROLLER_REL],
          proposedChanges: [validationChange()],
          runId: '../escape',
        }),
      ).rejects.toThrow(/Unsafe eng runId/);
      expect(() => assertSafeEngRunId('eng/../x')).toThrow(/Unsafe eng runId/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('eng gate policy', () => {
  const greenPackage = {
    status: 'ready' as const,
    editStats: { filesChanged: 1, linesAdded: 1, linesRemoved: 1 },
    testsRan: true,
    testsPassed: true,
    runs: [
      {
        kind: 'phpunit' as const,
        command: './vendor/bin/phpunit',
        cwd: '/tmp/demo',
        ran: true,
        skipped: false,
        exitCode: 0,
        durationMs: 10,
        summary: 'phpunit passed',
      },
    ],
  };

  it('requires a human gate for client-task regardless of green suites', () => {
    const decision = decideEngGate({
      category: 'client-task',
      autoApplyEng: true,
      package: greenPackage,
    });
    expect(decision.humanRequired).toBe(true);
    expect(decision.autoApply).toBe(false);
  });

  it('allows auto-apply only for an opted-in digital-product with green staged suites', () => {
    expect(
      decideEngGate({ category: 'digital-product', autoApplyEng: true, package: greenPackage })
        .autoApply,
    ).toBe(true);
    expect(
      decideEngGate({ category: 'digital-product', autoApplyEng: false, package: greenPackage })
        .autoApply,
    ).toBe(false);
    expect(
      evaluateEngAutoEligibility({
        category: 'digital-product',
        autoApplyEng: true,
        package: { ...greenPackage, testsRan: false, testsPassed: false, runs: [] },
      }).eligible,
    ).toBe(false);
    expect(
      evaluateEngAutoEligibility({
        category: 'digital-product',
        autoApplyEng: true,
        package: {
          ...greenPackage,
          testsRan: false,
          testsPassed: false,
          runs: [
            {
              kind: 'phpunit',
              command: './vendor/bin/phpunit',
              cwd: '/tmp',
              ran: false,
              skipped: true,
              skipReason: 'UMER_QA_SKIP_RUN=1',
              exitCode: null,
              durationMs: 0,
              summary: 'skipped',
            },
          ],
        },
      }).eligible,
    ).toBe(false);
    expect(
      evaluateEngAutoEligibility({
        category: 'digital-product',
        autoApplyEng: true,
        package: {
          ...greenPackage,
          testsPassed: false,
          runs: [{ ...greenPackage.runs[0]!, exitCode: 1, summary: 'fail' }],
        },
      }).eligible,
    ).toBe(false);
    expect(
      evaluateEngAutoEligibility({
        category: 'digital-product',
        autoApplyEng: true,
        package: {
          ...greenPackage,
          editStats: { filesChanged: 4, linesAdded: 4, linesRemoved: 0 },
        },
      }).eligible,
    ).toBe(false);
    expect(
      evaluateEngAutoEligibility({
        category: 'digital-product',
        autoApplyEng: true,
        package: {
          ...greenPackage,
          testsPassed: false,
          runs: [
            greenPackage.runs[0]!,
            {
              kind: 'playwright',
              command: 'npx playwright test',
              cwd: '/tmp',
              ran: false,
              skipped: true,
              skipReason: 'UMER_QA_SKIP_PLAYWRIGHT=1',
              exitCode: null,
              durationMs: 0,
              summary: 'skipped',
            },
          ],
        },
      }).eligible,
    ).toBe(false);
  });

  it('fails closed for an unknown category', () => {
    const decision = decideEngGate({
      category: 'something-new',
      autoApplyEng: true,
      package: greenPackage,
    });
    expect(decision.humanRequired).toBe(true);
    expect(decision.reason).toContain('fail closed');
  });
});

describe('autoApplyEng schema + SEO intake routing', () => {
  it('defaults omitted autoApplyEng to false', () => {
    const parsed = ProjectRecordSchema.parse({
      projectId: 'x',
      name: 'X',
      slug: 'x',
      path: 'x',
      category: 'client-task',
    });
    expect(parsed.autoApplyEng).toBe(false);
  });

  it('catalog entries resolve autoApplyEng false when omitted', async () => {
    const registry = await createProjectRegistry({ catalogPath });
    for (const p of registry.list()) {
      expect(p.autoApplyEng).toBe(false);
    }
  });

  it('seo intake never constructs engDelivery', async () => {
    const registry = await createProjectRegistry({ catalogPath });
    const sync = planIntake(registry, {
      projectId: 'cursive-generator',
      type: 'seo',
      goal: 'Improve landing and share-page discoverability',
      proposedChanges: [{ path: 'src/x.ts', expectedContent: null, content: 'nope' }],
    });
    expect(sync.seoAudit).toBeTruthy();
    expect(sync.engDelivery).toBeUndefined();

    const asyncPlan = await planIntakeWithEng(registry, {
      projectId: 'cursive-generator',
      type: 'seo',
      goal: 'Improve landing and share-page discoverability',
      proposedChanges: [{ path: 'src/x.ts', expectedContent: null, content: 'nope' }],
    });
    expect(asyncPlan.engDelivery).toBeUndefined();
  });
});

describe('staged runs + evidence capture + symlink guard', () => {
  it('marks testsPassed false when any discovered run is skipped (mixed)', () => {
    const bundle: QaRunBundle = {
      skippedAll: false,
      runs: [
        {
          kind: 'phpunit',
          command: './vendor/bin/phpunit',
          cwd: '/tmp',
          ran: true,
          skipped: false,
          exitCode: 0,
          durationMs: 1,
          summary: 'pass',
        },
        {
          kind: 'playwright',
          command: 'npx playwright test',
          cwd: '/tmp',
          ran: false,
          skipped: true,
          skipReason: 'skip',
          exitCode: null,
          durationMs: 0,
          summary: 'skipped',
        },
      ],
      files: [],
    };
    const result = evaluateStagedRuns(bundle);
    expect(result.testsRan).toBe(true);
    expect(result.testsPassed).toBe(false);
  });

  it('captures staged evidence files from a directory', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'umer-eng-ev-'));
    try {
      await writeFile(join(dir, 'phpunit-stdout.txt'), 'captured stdout\n', 'utf8');
      await writeFile(join(dir, 'phpunit-run.json'), '{"ok":true}\n', 'utf8');
      const captured = await captureStagedEvidence(dir);
      expect(captured.map((c) => c.name).sort()).toEqual([
        'phpunit-run.json',
        'phpunit-stdout.txt',
      ]);
      expect(captured.find((c) => c.name === 'phpunit-stdout.txt')?.content).toContain('captured');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('rejects symlink path components at the write boundary when creatable', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'umer-eng-link-'));
    const outside = await mkdtemp(join(tmpdir(), 'umer-eng-outside-'));
    try {
      const linkPath = join(dir, 'linked-out');
      try {
        await symlink(outside, linkPath, 'junction');
      } catch {
        // Windows may deny symlink creation without elevation — skip assertion.
        return;
      }
      await expect(assertNoSymlinkInProjectPath(dir, 'linked-out/secret.txt')).rejects.toThrow(
        /Symlink rejected/,
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
      await rm(outside, { recursive: true, force: true });
    }
  });
});
