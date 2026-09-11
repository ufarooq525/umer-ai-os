/**
 * Builds the review payload an operator sees *before* approving a gate.
 *
 * Pure function over already-computed state so it can be unit-tested: no disk reads, no
 * network, no mutation. Everything here is derived from the work package that the
 * specialist already produced.
 */

import type { IntakePlan, ProjectRegistry, ResolvedProject } from '@umer/registry';
import type { ArtifactContract } from '@umer/contracts';
import type { IntakeRecord, WorkPackageSummary } from './state.js';

export type ReviewFileChange = {
  path: string;
  action: 'create' | 'modify';
  linesAdded: number;
  linesRemoved: number;
  note: string;
  /** Unified diff for this file only. */
  diff: string;
};

export type ReviewTestRun = {
  kind: string;
  command: string;
  outcome: 'passed' | 'failed' | 'skipped';
  summary: string;
};

export type GateReview = {
  waitId: string;
  gateId: string;
  workPackageId: string;
  intakeId: string;
  projectId: string;
  projectName: string;
  /** What kind of work this gate is approving. */
  kind: 'code' | 'findings';
  /** One-line answer to "what am I approving?". */
  headline: string;
  /** What happens on Pass, in plain English. */
  onApprove: string;
  goal: string;
  requestedType: string;
  routing?: {
    suggestedType: string;
    agreed: boolean;
    note: string;
    confidence: string;
  };
  /** Present for feature/bug gates. */
  code?: {
    runId: string;
    status: string;
    rationale: string;
    author: string;
    authorStatus: string;
    filesChanged: number;
    linesAdded: number;
    linesRemoved: number;
    files: ReviewFileChange[];
    testsRan: boolean;
    testsPassed: boolean;
    testCommand?: string;
    runs: ReviewTestRun[];
    blockers: string[];
  };
  /** Present for report-only desks (seo/security/perf/ux/qa). */
  findings?: {
    runId?: string;
    summary: string;
    counts: Record<string, number>;
    items: Array<{
      id: string;
      title: string;
      severity: string;
      detail: string;
      path?: string;
    }>;
  };
  acceptanceCriteria: string[];
  risks: string[];
  nextActions: string[];
};

const DIFF_HEADER = /^diff --git /m;

/**
 * Split the work package's unified diff into per-file hunks so the UI can render one
 * card per file instead of a single wall of text.
 */
export function splitUnifiedDiff(diff: string): Map<string, string> {
  const byPath = new Map<string, string>();
  if (!diff.trim() || !DIFF_HEADER.test(diff)) return byPath;

  const sections = diff.split(/^(?=diff --git )/m).filter((s) => s.trim().length > 0);
  for (const section of sections) {
    const match = section.match(/^diff --git a\/(.+?) b\/(.+?)$/m);
    const path = match?.[2] ?? match?.[1];
    if (!path) continue;
    byPath.set(path.trim(), section.replace(/\s+$/, ''));
  }
  return byPath;
}

function countDiffLines(diff: string): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const line of diff.split(/\r?\n/)) {
    if (line.startsWith('+++') || line.startsWith('---')) continue;
    if (line.startsWith('+')) added += 1;
    else if (line.startsWith('-')) removed += 1;
  }
  return { added, removed };
}

function runOutcome(run: {
  ran: boolean;
  skipped: boolean;
  exitCode: number | null;
}): ReviewTestRun['outcome'] {
  if (run.skipped || !run.ran) return 'skipped';
  return run.exitCode === 0 ? 'passed' : 'failed';
}

function authorLabel(plan: IntakePlan): { author: string; authorStatus: string } {
  const production = plan.engDelivery?.production;
  if (!production) {
    return { author: 'intake change-set', authorStatus: 'supplied' };
  }
  if (production.status === 'skipped') {
    return { author: 'intake change-set', authorStatus: 'supplied' };
  }
  return { author: production.producerId, authorStatus: production.status };
}

function buildCodeReview(plan: IntakePlan): GateReview['code'] | undefined {
  const eng = plan.engDelivery;
  if (!eng) return undefined;

  const diffByPath = splitUnifiedDiff(eng.proposedDiff);
  const files: ReviewFileChange[] = eng.edits.map((edit) => {
    const diff = diffByPath.get(edit.path) ?? '';
    const counts = countDiffLines(diff);
    return {
      path: edit.path,
      action: edit.action,
      linesAdded: counts.added,
      linesRemoved: counts.removed,
      note: edit.note,
      diff,
    };
  });

  const { author, authorStatus } = authorLabel(plan);

  return {
    runId: eng.runId,
    status: eng.status,
    rationale: eng.rationale,
    author,
    authorStatus,
    filesChanged: eng.editStats.filesChanged,
    linesAdded: eng.editStats.linesAdded,
    linesRemoved: eng.editStats.linesRemoved,
    files,
    testsRan: eng.testsRan,
    testsPassed: eng.testsPassed,
    testCommand: eng.recommendedCommand,
    runs: eng.runs.map((run) => ({
      kind: run.kind,
      command: run.command,
      outcome: runOutcome(run),
      summary: run.summary,
    })),
    blockers: eng.blockers,
  };
}

function buildFindingsReview(plan: IntakePlan): GateReview['findings'] | undefined {
  if (plan.securityAudit) {
    return {
      runId: plan.securityAudit.runId,
      summary: plan.securityAudit.summary,
      counts: plan.securityAudit.severityCounts,
      items: plan.securityAudit.findings.map((f) => ({
        id: f.id,
        title: f.title,
        severity: f.severity,
        detail: f.remediation,
        path: f.path,
      })),
    };
  }

  if (plan.perfAudit) {
    return {
      runId: plan.perfAudit.runId,
      summary: plan.perfAudit.summary,
      counts: plan.perfAudit.severityCounts,
      items: plan.perfAudit.findings.map((f) => ({
        id: f.id,
        title: f.title,
        severity: f.severity,
        detail: f.remediation,
      })),
    };
  }

  const checklist = plan.uxAudit ?? plan.seoAudit ?? plan.qaAudit;
  if (checklist) {
    const counts: Record<string, number> = { P0: 0, P1: 0, P2: 0 };
    for (const item of checklist.items) {
      counts[item.priority] = (counts[item.priority] ?? 0) + 1;
    }
    return {
      runId: 'runId' in checklist ? (checklist.runId as string) : undefined,
      summary: checklist.summary,
      counts,
      items: checklist.items.map((item) => ({
        id: item.id,
        title: item.title,
        severity: item.priority,
        detail: item.howToVerify,
      })),
    };
  }

  return undefined;
}

function headlineFor(input: {
  plan: IntakePlan;
  code: GateReview['code'];
  findings: GateReview['findings'];
}): { headline: string; onApprove: string } {
  const { plan, code, findings } = input;

  if (code) {
    if (code.status !== 'ready') {
      return {
        headline: `${plan.projectName}: no code is ready to apply — ${code.blockers.length} blocker(s) need a human first.`,
        onApprove:
          'Approving will not write any code, because the work package never reached a reviewable change-set.',
      };
    }
    const testLabel = code.testsPassed
      ? 'staged tests passed'
      : code.testsRan
        ? 'staged tests did NOT all pass'
        : 'no staged test actually ran';
    return {
      headline: `${plan.projectName}: ${code.filesChanged} file(s), +${code.linesAdded}/-${code.linesRemoved}, ${testLabel}. Authored by ${code.author}.`,
      onApprove: `Approving writes these ${code.filesChanged} file(s) into ${plan.absolutePath} and seals evidence under .umer/eng/${code.runId}/. Nothing is pushed to git — that stays yours.`,
    };
  }

  if (findings) {
    const counted = Object.entries(findings.counts)
      .filter(([, n]) => n > 0)
      .map(([k, n]) => `${n} ${k}`)
      .join(', ');
    return {
      headline: `${plan.projectName}: ${findings.items.length} finding(s)${counted ? ` (${counted})` : ''} — report only, no product code changes.`,
      onApprove:
        'Approving seals the findings package as evidence. To change code, raise a follow-up feature or bug task.',
    };
  }

  return {
    headline: `${plan.projectName}: intake plan for review (${plan.type}).`,
    onApprove: 'Approving records the plan; no files are written.',
  };
}

export type PendingGateLike = {
  waitId: string;
  gateId: string;
  workPackageId: string;
};

function buildRuntimeWorkPackageReview(input: {
  gate: PendingGateLike;
  workPackage: WorkPackageSummary;
  artifact?: ArtifactContract;
  projectRegistry?: ProjectRegistry;
}): GateReview {
  const { gate, workPackage, artifact, projectRegistry } = input;
  let project: ResolvedProject | undefined;
  if (projectRegistry && workPackage.projectId) {
    try {
      project = projectRegistry.get(workPackage.projectId);
    } catch {
      project = undefined;
    }
  }
  const projectName = project?.name ?? workPackage.projectId ?? workPackage.execId;
  const projectId = project?.projectId ?? workPackage.projectId ?? workPackage.execId;

  if (artifact && artifact.artifactType === 'Code') {
    const annotations = (artifact.metadata?.annotations ?? {}) as Record<string, string>;
    const proposedDiff = annotations.proposedDiff ?? '';
    const diffByPath = splitUnifiedDiff(proposedDiff);
    const filesChanged = Number(annotations.filesChanged ?? diffByPath.size ?? 0);
    const linesAdded = Number(annotations.linesAdded ?? 0);
    const linesRemoved = Number(annotations.linesRemoved ?? 0);
    const testsRan = annotations.testsRan === 'true';
    const testsPassed = annotations.testsPassed === 'true';
    const runId = annotations.runId ?? `eng-${workPackage.workPackageId}`;

    const files: ReviewFileChange[] = [];
    for (const [path, diff] of diffByPath.entries()) {
      const counts = countDiffLines(diff);
      files.push({
        path,
        action: 'modify',
        linesAdded: counts.added,
        linesRemoved: counts.removed,
        note: `Change proposed by ${workPackage.specialistId}`,
        diff,
      });
    }

    const runs: ReviewTestRun[] = testsRan
      ? [
          {
            kind: 'phpunit',
            command: project?.qaTestCommand ?? './vendor/bin/phpunit',
            outcome: testsPassed ? 'passed' : 'failed',
            summary: testsPassed
              ? 'Staged unit/feature test suite passed'
              : 'Staged test execution failed',
          },
        ]
      : [];

    const testLabel = testsPassed
      ? 'staged tests passed'
      : testsRan
        ? 'staged tests did NOT all pass'
        : 'no staged test actually ran';

    const headline = `${projectName}: ${filesChanged} file(s), +${linesAdded}/-${linesRemoved}, ${testLabel}. Authored by ${workPackage.specialistId}.`;
    const onApprove = `Approving accepts this delivery in the Work Graph, advances execution to QA and Security gates, and allows applying changes to ${project?.absolutePath ?? 'workspace'}.`;

    return {
      waitId: gate.waitId,
      gateId: gate.gateId,
      workPackageId: gate.workPackageId,
      intakeId: `runtime-${workPackage.workPackageId}`,
      projectId,
      projectName,
      kind: 'code',
      headline,
      onApprove,
      goal: `Autonomous delivery for ${workPackage.workPackageId}`,
      requestedType: 'feature',
      code: {
        runId,
        status: testsPassed ? 'ready' : 'failed',
        rationale: `Autonomous engineering delivery executed in isolated staging workspace by specialist ${workPackage.specialistId}.`,
        author: workPackage.specialistId,
        authorStatus: 'produced',
        filesChanged,
        linesAdded,
        linesRemoved,
        files,
        testsRan,
        testsPassed,
        testCommand: project?.qaTestCommand ?? './vendor/bin/phpunit',
        runs,
        blockers: testsPassed ? [] : ['Staged tests did not pass.'],
      },
      acceptanceCriteria: artifact.acceptanceCriteriaMet.map((c) => `${c.criterion}: ${c.status}`),
      risks: testsPassed ? [] : ['Staged test failure — applying may break project test suite.'],
      nextActions: testsPassed
        ? [
            'Approve gate to hand off to QA & Security verification',
            'Reject gate if diff does not meet requirements',
          ]
        : ['Inspect staging failure and reject work package for retry'],
    };
  }

  const headline = `${projectName}: ${workPackage.stage} review (${workPackage.specialistId}).`;
  return {
    waitId: gate.waitId,
    gateId: gate.gateId,
    workPackageId: gate.workPackageId,
    intakeId: `runtime-${workPackage.workPackageId}`,
    projectId,
    projectName,
    kind: 'findings',
    headline,
    onApprove: `Approving accepts stage ${workPackage.stage} and advances the Work Graph.`,
    goal: `Deliver ${workPackage.stage}`,
    requestedType: workPackage.stage.toLowerCase(),
    acceptanceCriteria: artifact?.acceptanceCriteriaMet.map((c) => `${c.criterion}: ${c.status}`) ?? [],
    risks: [],
    nextActions: ['Review deliverables and decide on gate approval'],
  };
}

/**
 * Assemble the review for one pending gate. Returns null when the gate has no intake
 * or runtime Work Package behind it, so callers can 404 rather than invent content.
 */
export function buildGateReview(input: {
  gate: PendingGateLike;
  intakes: IntakeRecord[];
  workPackages?: WorkPackageSummary[];
  artifacts?: ArtifactContract[];
  projectRegistry?: ProjectRegistry;
}): GateReview | null {
  const intake = input.intakes.find(
    (item) => `wp-${item.intakeId}` === input.gate.workPackageId,
  );
  if (intake) {
    const plan = intake.plan;
    const code = buildCodeReview(plan);
    const findings = code ? undefined : buildFindingsReview(plan);
    const { headline, onApprove } = headlineFor({ plan, code, findings });

    return {
      waitId: input.gate.waitId,
      gateId: input.gate.gateId,
      workPackageId: input.gate.workPackageId,
      intakeId: intake.intakeId,
      projectId: plan.projectId,
      projectName: plan.projectName,
      kind: code ? 'code' : 'findings',
      headline,
      onApprove,
      goal: plan.goal,
      requestedType: plan.type,
      routing: plan.routing
        ? {
            suggestedType: plan.routing.suggestedType,
            agreed: plan.routing.agreed,
            note: plan.routing.note,
            confidence: plan.routing.confidence,
          }
        : undefined,
      code,
      findings,
      acceptanceCriteria: plan.acceptanceCriteria,
      risks: plan.risks,
      nextActions: plan.nextActions,
    };
  }

  // Runtime Work Package lookup
  const wp = input.workPackages?.find(
    (w) =>
      w.workPackageId === input.gate.workPackageId ||
      input.gate.gateId === `gate-wp-${w.workPackageId}`,
  );
  if (!wp) return null;

  const artifact =
    (wp.artifactId
      ? input.artifacts?.find((a) => a.artifactId === wp.artifactId)
      : undefined) ??
    input.artifacts?.find(
      (a) => a.producedFor === wp.execId || a.version?.includes(wp.workPackageId),
    );

  return buildRuntimeWorkPackageReview({
    gate: input.gate,
    workPackage: wp,
    artifact,
    projectRegistry: input.projectRegistry,
  });
}
