import { mkdir, writeFile, cp, rm, readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { collectQaRepoSignals, type QaRepoSignals } from './qa-verify.js';
import { runQaSuites, type QaCommandRun, type QaRunBundle } from './qa-run.js';
import {
  resolveEngScope,
  type EngScope,
  ENG_MAX_FILES_DEFAULT,
  assertSafeEngRunId,
} from './eng-scope.js';
import {
  buildProposedDiff,
  resolveEngChangeSet,
  summarizeEditStats,
  type EngChangeSetEntry,
  type EngResolvedEdit,
} from './eng-diff.js';
import {
  buildChangeSetDraft,
  createProjectFileReader,
  validateProducedChangeSet,
  type CodeProducer,
  type EngProductionRecord,
} from './code-producer.js';
import type { ResolvedProject } from './types.js';

export type EngDeliveryType = 'feature' | 'bug';

export type EngPriority = 'P0' | 'P1' | 'P2';

export type EngTestCategory = 'unit' | 'feature' | 'ui' | 'regression' | 'manual' | 'release';

export type EngTestPlanItem = {
  id: string;
  category: EngTestCategory;
  title: string;
  priority: EngPriority;
  check: string;
  howToVerify: string;
};

/** `ready` may be applied on gate Pass / eligible auto; `needs-manual-scoping` must not. */
export type EngWorkPackageStatus = 'ready' | 'needs-manual-scoping';

/** Captured staging suite artifact (survives staging cleanup; sealed on apply). */
export type EngStagedEvidenceFile = {
  /** Basename only, e.g. `phpunit-stdout.txt`. */
  name: string;
  /** Truncated text/json body. */
  content: string;
};

const STAGED_EVIDENCE_MAX_FILES = 24;
const STAGED_EVIDENCE_MAX_BYTES = 200_000;

export type EngDeliveryReport = {
  specialistId: 'eng.app-delivery';
  runId: string;
  projectId: string;
  projectName: string;
  absolutePath: string;
  type: EngDeliveryType;
  goal: string;
  summary: string;
  status: EngWorkPackageStatus;
  scope: EngScope;
  /** Plain-English explanation of what the change does and why. */
  rationale: string;
  /**
   * Human-readable unified diff for review only.
   * Apply uses `edits` / the intake change-set — never a free-form patch parser.
   */
  proposedDiff: string;
  edits: EngResolvedEdit[];
  /** Echo of the validated intake change-set (for apply / audit). */
  changeSet: EngChangeSetEntry[];
  editStats: { filesChanged: number; linesAdded: number; linesRemoved: number };
  testPlan: EngTestPlanItem[];
  signals: QaRepoSignals;
  recommendedCommand?: string;
  /** True when at least one allowlisted suite actually ran (not skipped). */
  testsRan: boolean;
  /**
   * True only when ≥1 suite was discovered, every discovered suite actually ran
   * (none skipped), and every exit code is 0. Mixed pass+skip ⇒ false.
   */
  testsPassed: boolean;
  runs: QaCommandRun[];
  runBundle?: QaRunBundle;
  /** Suite logs captured from staging before cleanup (bounded). */
  stagedEvidence: EngStagedEvidenceFile[];
  /** Who authored the change-set (producer adapter), when one was consulted. */
  production?: EngProductionRecord;
  quickWins: string[];
  nextActions: string[];
  /** Non-empty when the package needs a human before it can be applied. */
  blockers: string[];
};

function item(
  id: string,
  category: EngTestCategory,
  title: string,
  priority: EngPriority,
  check: string,
  howToVerify: string,
): EngTestPlanItem {
  return { id, category, title, priority, check, howToVerify };
}

export function engRunId(projectId: string, at: Date = new Date()): string {
  const stamp = at.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  return assertSafeEngRunId(`eng-${projectId}-${stamp}`);
}

function buildTestPlan(input: {
  type: EngDeliveryType;
  goal: string;
  doneWhen?: string;
  scope: EngScope;
  signals: QaRepoSignals;
  recommendedCommand?: string;
}): EngTestPlanItem[] {
  const touched = input.scope.files.map((f) => f.path).join(', ') || '(unscoped)';
  const items: EngTestPlanItem[] = [
    item(
      'eng-change-compiles',
      'unit',
      'Change loads without syntax/type errors',
      'P0',
      'Edited files parse and the project still boots (PHP lint / tsc / dev server start)',
      `Lint or type-check the touched files: ${touched}`,
    ),
    item(
      input.type === 'bug' ? 'eng-bug-repro' : 'eng-feature-acceptance',
      'feature',
      input.type === 'bug'
        ? 'Failing case reproduces before, passes after'
        : 'Acceptance criteria covered by a test',
      'P0',
      input.type === 'bug'
        ? 'A test reproduces the reported defect against the pre-change code and passes against the change-set'
        : 'At least one test asserts the new behaviour described in the goal',
      input.doneWhen?.trim() || `Add or extend a test for: ${input.goal}`,
    ),
    item(
      'eng-regression-suite',
      'regression',
      'Existing suite still green',
      input.signals.hasPhpUnit || input.signals.hasPest || input.signals.packageTestScript
        ? 'P0'
        : 'P1',
      'The project test suite passes with the change applied in staging — no collateral breakage',
      input.recommendedCommand
        ? `Run \`${input.recommendedCommand}\` against the staged copy`
        : 'No suite detected — testsPassed stays false until a suite runs',
    ),
  ];

  if (input.signals.hasPlaywright || input.signals.hasFrontendSpa) {
    items.push(
      item(
        'eng-ui-smoke',
        'ui',
        'UI smoke on affected screens',
        'P1',
        'Screens reachable from the change render without console fatals',
        input.signals.hasPlaywright
          ? 'Run the Playwright suite; add a spec if the change is user-visible'
          : 'Walk the affected screens in the local SPA',
      ),
    );
  }

  items.push(
    item(
      'eng-manual-review',
      'manual',
      'Diff reviewed against project conventions',
      'P0',
      'Change matches surrounding code style, has no debug output, and leaks no secrets',
      'Read proposedDiff in the work package before approving the gate',
    ),
    item(
      'eng-evidence',
      'release',
      'Evidence package sealed',
      'P0',
      'Diff, rationale, test plan, and run logs sealed under .umer/eng/<runId>/',
      'Approve the eng gate (or eligible digital-product auto) so apply writes APPLY_REPORT.md',
    ),
  );

  return items;
}

function buildRationale(input: {
  project: ResolvedProject;
  type: EngDeliveryType;
  goal: string;
  edits: EngResolvedEdit[];
  blockers: string[];
}): string {
  const lines: string[] = [];
  const what = input.type === 'bug' ? 'fix' : 'change';

  if (input.blockers.length > 0) {
    lines.push(
      `This ${what} was not attempted automatically. ${input.blockers.join(' ')} A human needs to scope it into ≤${ENG_MAX_FILES_DEFAULT}-file work packages and supply an explicit change-set before eng.app-delivery can propose a diff.`,
    );
    return lines.join('\n\n');
  }

  const fileList = input.edits.map((e) => e.path).join(', ');
  lines.push(
    `Goal: ${input.goal}. This is a ${input.type} ${what} in ${input.project.name}, scoped to ${input.edits.length} file(s): ${fileList}.`,
  );

  for (const edit of input.edits) {
    lines.push(
      `- \`${edit.path}\` (${edit.action === 'create' ? 'new file' : 'edited'}): ${edit.note}`,
    );
  }

  lines.push(
    input.type === 'bug'
      ? 'The change-set is intentionally narrow — it targets the reported defect only, so the blast radius stays reviewable and the change is easy to revert if the suite goes red.'
      : 'The change-set is intentionally narrow — it adds the requested behaviour without refactoring surrounding code, so review stays cheap and revert stays trivial.',
  );

  if (input.project.constraints.length > 0) {
    lines.push(`Project constraints respected: ${input.project.constraints.join('; ')}.`);
  }

  return lines.join('\n\n');
}

async function stageProjectWithEdits(input: {
  root: string;
  edits: EngResolvedEdit[];
}): Promise<{ stagingRoot: string; cleanup: () => Promise<void> }> {
  const stagingRoot = await mkdtemp(join(tmpdir(), 'umer-eng-stage-'));
  await cp(input.root, stagingRoot, {
    recursive: true,
    filter: (src) => {
      const name = src.replace(/\\/g, '/').split('/').pop() ?? '';
      return name !== '.git' && name !== 'node_modules' && name !== '.umer';
    },
  });

  for (const edit of input.edits) {
    const dest = join(stagingRoot, edit.path);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, edit.after, 'utf8');
  }

  return {
    stagingRoot,
    cleanup: async () => {
      await rm(stagingRoot, { recursive: true, force: true });
    },
  };
}

/**
 * Capture suite artifacts from the staging evidence dir before it is deleted.
 * Basename-only; content bounded so the report stays memory-safe.
 */
export async function captureStagedEvidence(
  evidenceDir: string,
): Promise<EngStagedEvidenceFile[]> {
  let names: string[] = [];
  try {
    names = await readdir(evidenceDir);
  } catch {
    return [];
  }

  const captured: EngStagedEvidenceFile[] = [];
  for (const name of names) {
    if (captured.length >= STAGED_EVIDENCE_MAX_FILES) break;
    if (!/^[A-Za-z0-9._-]+$/.test(name)) continue;
    try {
      const raw = await readFile(join(evidenceDir, name), 'utf8');
      captured.push({
        name,
        content: raw.slice(0, STAGED_EVIDENCE_MAX_BYTES),
      });
    } catch {
      /* skip unreadable */
    }
  }
  return captured;
}

/**
 * Every discovered run must have actually run (not skipped) and exit 0.
 * A mix of one pass + one skipped ⇒ testsPassed=false.
 */
export function evaluateStagedRuns(bundle: QaRunBundle): {
  testsRan: boolean;
  testsPassed: boolean;
} {
  if (bundle.runs.length === 0) {
    return { testsRan: false, testsPassed: false };
  }
  const anyRan = bundle.runs.some((r) => r.ran);
  const allActuallyRan = bundle.runs.every((r) => r.ran && !r.skipped);
  if (!allActuallyRan) {
    return { testsRan: anyRan, testsPassed: false };
  }
  const testsPassed = bundle.runs.every((r) => r.exitCode === 0);
  return { testsRan: true, testsPassed };
}

/**
 * eng.app-delivery runner.
 *
 * Produces a work package (proposedDiff + rationale + test plan) for feature|bug intake.
 * Tests run only against an isolated staging copy — the real Laragon tree is read-only
 * until applyEngToProject after approval / eligible auto-apply.
 *
 * The runner never writes code itself. Either intake supplies `proposedChanges`
 * (path + expected base + replacement content), or an injected `codeProducer` authors
 * one. Both paths are validated for path safety, scope, and base freshness before a
 * review diff is rendered.
 */
export async function runEngDelivery(input: {
  project: ResolvedProject;
  type: EngDeliveryType;
  goal: string;
  doneWhen?: string;
  targetFiles?: string[];
  targetModule?: string;
  /** Explicit change-set from intake (required for a ready package). */
  proposedChanges?: EngChangeSetEntry[];
  /** Authors the change-set when intake did not supply one. */
  codeProducer?: CodeProducer;
  /** Override for deterministic evidence paths in tests. */
  runId?: string;
}): Promise<EngDeliveryReport> {
  const root = input.project.absolutePath;
  const runId = assertSafeEngRunId(input.runId?.trim() || engRunId(input.project.projectId));

  const liveSignals = await collectQaRepoSignals(root);

  const explicitTargets =
    (input.targetFiles?.length ?? 0) > 0 || Boolean(input.targetModule?.trim());

  let scope = await resolveEngScope({
    root,
    targetFiles: input.targetFiles,
    targetModule: input.targetModule,
  });

  const blockers: string[] = [];
  let proposedChanges = input.proposedChanges ?? [];
  let resolved: EngResolvedEdit[] = [];
  let changeSet: EngChangeSetEntry[] = [];
  let production: EngProductionRecord | undefined;

  if (input.codeProducer) {
    const producer = input.codeProducer;
    const draft = await buildChangeSetDraft({
      root,
      scopeFiles: scope.files,
      maxFiles: scope.maxFiles,
    });

    if (proposedChanges.length > 0) {
      production = {
        producerId: producer.id,
        producerDescription: producer.describe(),
        status: 'skipped',
        reason: 'Intake supplied an explicit change-set, so no producer was consulted',
        notes: [],
        changeCount: proposedChanges.length,
        problems: [],
        draft,
      };
    } else {
      const outcome = await producer.produce({
        projectId: input.project.projectId,
        projectName: input.project.name,
        absolutePath: root,
        category: input.project.category,
        type: input.type,
        goal: input.goal,
        doneWhen: input.doneWhen,
        scopeFiles: scope.files.map((f) => ({ path: f.path, exists: f.exists })),
        targetModule: input.targetModule,
        maxFiles: scope.maxFiles,
        readProjectFile: createProjectFileReader(root),
      });

      if (outcome.status === 'produced') {
        const problems = validateProducedChangeSet({
          root,
          changes: outcome.changes,
          maxFiles: scope.maxFiles,
          allowedPaths: explicitTargets ? scope.files.map((f) => f.path) : undefined,
        });
        production = {
          producerId: producer.id,
          producerDescription: producer.describe(),
          status: 'produced',
          notes: outcome.notes ?? [],
          changeCount: outcome.changes.length,
          problems,
          draft,
        };
        if (problems.length > 0) {
          blockers.push(...problems.map((p) => `Code producer ${producer.id}: ${p}`));
        } else {
          proposedChanges = outcome.changes;
        }
      } else {
        production = {
          producerId: producer.id,
          producerDescription: producer.describe(),
          status: 'declined',
          reason: outcome.reason,
          notes: outcome.notes ?? [],
          changeCount: 0,
          problems: [],
          draft,
        };
        blockers.push(`Code producer ${producer.id} declined: ${outcome.reason}`);
      }
    }
  }

  if (proposedChanges.length === 0) {
    if (!production || production.status === 'produced') {
      blockers.push(
        'No proposedChanges supplied — eng.app-delivery does not invent code; pass an explicit change-set.',
      );
    }
  } else {
    // Derive target scope from change paths when the caller omitted targetFiles.
    if (!explicitTargets) {
      scope = await resolveEngScope({
        root,
        targetFiles: proposedChanges.map((c) => c.path),
      });
    }

    if (scope.status === 'needs-manual-scoping') {
      blockers.push(...scope.reasons);
    }

    const resolution = await resolveEngChangeSet({ root, changes: proposedChanges });
    resolved = resolution.edits;
    blockers.push(...resolution.problems);

    if (explicitTargets && scope.files.length > 0) {
      const scoped = new Set(scope.files.map((f) => f.path));
      for (const edit of resolved) {
        if (!scoped.has(edit.path)) {
          blockers.push(`Edit to ${edit.path} is outside the declared target scope`);
        }
      }
    }

    const uniquePaths = new Set(resolved.map((e) => e.path));
    if (uniquePaths.size > scope.maxFiles) {
      blockers.push(
        `Change-set spans ${uniquePaths.size} files (limit ${scope.maxFiles}) — split the work package.`,
      );
    }

    changeSet = proposedChanges.map((c) => ({
      ...c,
      path: c.path.trim().replace(/\\/g, '/'),
    }));
  }

  if (proposedChanges.length === 0 && scope.status === 'needs-manual-scoping') {
    blockers.push(...scope.reasons);
  }

  const recommendedCommand =
    input.project.qaTestCommand?.trim() || liveSignals.detectedCommands[0] || undefined;

  let testsRan = false;
  let testsPassed = false;
  let runs: QaCommandRun[] = [];
  let runBundle: QaRunBundle | undefined;
  let stagedEvidence: EngStagedEvidenceFile[] = [];

  const structurallyReady =
    blockers.length === 0 && resolved.length > 0 && resolved.length <= scope.maxFiles;

  if (structurallyReady) {
    const staged = await stageProjectWithEdits({ root, edits: resolved });
    try {
      const evidenceDir = join(staged.stagingRoot, '.umer', 'eng', runId, 'evidence');
      await mkdir(evidenceDir, { recursive: true });
      const stagedProject: ResolvedProject = {
        ...input.project,
        absolutePath: staged.stagingRoot,
      };
      const stagedSignals = await collectQaRepoSignals(staged.stagingRoot);
      runBundle = await runQaSuites({
        project: stagedProject,
        signals: stagedSignals,
        evidenceDir,
        evidenceRelPrefix: `.umer/eng/${runId}/evidence`,
      });
      // Preserve logs before staging cleanup deletes the temp tree.
      stagedEvidence = await captureStagedEvidence(evidenceDir);
      runs = runBundle.runs;
      const evalResult = evaluateStagedRuns(runBundle);
      testsRan = evalResult.testsRan;
      testsPassed = evalResult.testsPassed;
    } finally {
      await staged.cleanup();
    }
  }

  const status: EngWorkPackageStatus = structurallyReady ? 'ready' : 'needs-manual-scoping';

  const proposedDiff = status === 'ready' ? buildProposedDiff(resolved) : '';
  const editStats = summarizeEditStats(status === 'ready' ? resolved : []);
  const testPlan = buildTestPlan({
    type: input.type,
    goal: input.goal,
    doneWhen: input.doneWhen,
    scope,
    signals: liveSignals,
    recommendedCommand,
  });

  const summary =
    status === 'ready'
      ? `eng.app-delivery work package ${runId} for ${input.project.name}: ${editStats.filesChanged} file(s), +${editStats.linesAdded}/-${editStats.linesRemoved}, testsRan=${testsRan} testsPassed=${testsPassed}, cmd=${recommendedCommand ?? 'none'}.`
      : `eng.app-delivery work package ${runId} for ${input.project.name} needs manual scoping: ${blockers.length} blocker(s).`;

  return {
    specialistId: 'eng.app-delivery',
    runId,
    projectId: input.project.projectId,
    projectName: input.project.name,
    absolutePath: root,
    type: input.type,
    goal: input.goal,
    summary,
    status,
    scope,
    rationale: buildRationale({
      project: input.project,
      type: input.type,
      goal: input.goal,
      edits: resolved,
      blockers,
    }),
    proposedDiff,
    edits: status === 'ready' ? resolved : [],
    changeSet: status === 'ready' ? changeSet : [],
    editStats,
    testPlan,
    signals: liveSignals,
    recommendedCommand,
    testsRan,
    testsPassed,
    runs,
    runBundle,
    stagedEvidence: status === 'ready' ? stagedEvidence : [],
    production,
    quickWins:
      status === 'ready'
        ? [
            'Review proposedDiff — it is small by design',
            recommendedCommand
              ? `Staged run used allowlisted \`${recommendedCommand}\` when resolvable`
              : 'Set qaTestCommand so staging can execute a suite (required for digital-product auto)',
            'Approve the eng gate (or eligible auto) to apply and seal evidence under .umer/eng/',
          ]
        : [
            'Name the exact file(s) or module to change',
            `Supply proposedChanges (≤${scope.maxFiles} unique files) with expectedContent + content`,
            'Re-submit as separate feature/bug intakes if the blast radius is larger',
          ],
    nextActions: [
      `Work in ${root}`,
      status === 'ready'
        ? 'Human gate Pass (or eligible digital-product auto) required before the change touches the Laragon project'
        : 'Manual scoping required — runner will not apply this change',
      input.doneWhen?.trim() || 'Diff reviewed, suite green, evidence sealed',
      'Handoff to qa.verify after apply for independent verification',
    ],
    blockers,
  };
}
