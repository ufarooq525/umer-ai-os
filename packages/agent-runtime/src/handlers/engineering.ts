import {
  parseContract,
  SCHEMA_VERSION,
  ArtifactContractSchema,
  type ArtifactContract,
  type WorkPackageContract,
} from '@umer/contracts';
import type { SpecialistMandate } from '@umer/specialist-sdk';
import type { RetrievalBundle } from '@umer/memory-access';
import {
  runEngDelivery,
  type CodeProducer,
  type EngChangeSetEntry,
  type ResolvedProject,
  type EngDeliveryReport,
} from '@umer/registry';

export type SpecialistRunResult = {
  summary: string;
  artifact: ArtifactContract;
  memoryCitations?: RetrievalBundle['citations'];
  deliveryReport?: EngDeliveryReport;
};

export type EngineeringDeliveryOptions = {
  retrievalBundle?: RetrievalBundle;
  codeProducer?: CodeProducer;
  deliveryRunner?: (input: {
    project: ResolvedProject;
    type: 'feature' | 'bug';
    goal: string;
    doneWhen?: string;
    targetFiles?: string[];
    targetModule?: string;
    proposedChanges?: EngChangeSetEntry[];
    codeProducer?: CodeProducer;
    runId?: string;
  }) => Promise<EngDeliveryReport>;
};

/**
 * Engineering Specialist handler for Milestone M5 (Real Autonomous Engineering Delivery).
 *
 * When an explicit change-set or codeProducer is supplied alongside a valid targetPath,
 * executes the real isolated staging delivery pipeline:
 *   1. Resolves and validates file scope and content hashes against the repository.
 *   2. Stages the project in a temporary isolation directory.
 *   3. Applies scoped edits in staging.
 *   4. Runs allowlisted test suites against staging.
 *   5. Captures unified diffs and test logs, producing a `submitted` `Code` artifact
 *      with verified evidence awaiting human gate review.
 *
 * When ungrounded or without an explicit change-set/producer, honestly falls back to
 * `draft` with `N_A` criteria, never fabricating code or claiming unverified completion.
 */
export async function runEngineeringApplicationDelivery(
  workPackage: WorkPackageContract,
  mandate: SpecialistMandate,
  options?: EngineeringDeliveryOptions,
): Promise<SpecialistRunResult> {
  const now = new Date().toISOString();
  const artifactId = `art-${workPackage.workPackageId}-${workPackage.attempt}`;

  const citations = options?.retrievalBundle?.citations ?? [];
  const citationNote =
    citations.length > 0
      ? ` (${citations.length} organizational lesson${citations.length === 1 ? '' : 's'} cited)`
      : '';

  // Extract change-set, targetFiles, targetModule from metadata.annotations if present
  const rawChangeSet = workPackage.metadata.annotations?.changeSet;
  let proposedChanges: EngChangeSetEntry[] | undefined;
  if (typeof rawChangeSet === 'string') {
    try {
      proposedChanges = JSON.parse(rawChangeSet) as EngChangeSetEntry[];
    } catch {
      // Ignore: fallback to codeProducer
    }
  } else if (Array.isArray(rawChangeSet)) {
    proposedChanges = rawChangeSet as EngChangeSetEntry[];
  }

  const rawTargetFiles = workPackage.metadata.annotations?.targetFiles;
  let targetFiles: string[] | undefined;
  if (typeof rawTargetFiles === 'string') {
    try {
      targetFiles = JSON.parse(rawTargetFiles) as string[];
    } catch {
      targetFiles = rawTargetFiles
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
  } else if (Array.isArray(rawTargetFiles)) {
    targetFiles = rawTargetFiles.map(String);
  }

  const rawTargetModule = workPackage.metadata.annotations?.targetModule;
  const targetModule = typeof rawTargetModule === 'string' ? rawTargetModule : undefined;

  const rawInstruction = workPackage.metadata.annotations?.instruction;
  const goal =
    typeof rawInstruction === 'string' && rawInstruction.trim().length > 0
      ? rawInstruction
      : `Deliver implementation for tasks: ${workPackage.taskIds.join(', ')}`;

  const runner = options?.deliveryRunner ?? runEngDelivery;

  // Real delivery execution: when targetPath is present and either proposedChanges or codeProducer exists
  if (workPackage.targetPath && (proposedChanges || options?.codeProducer)) {
    const project: ResolvedProject = {
      projectId: workPackage.execId,
      name: workPackage.execId,
      slug: workPackage.execId.toLowerCase(),
      path: workPackage.targetPath,
      absolutePath: workPackage.targetPath,
      status: 'active',
      category: 'digital-product',
      stack: [],
      defaultSpecialists: ['eng.app-delivery'],
      constraints: [],
      tags: [],
      autoApplyEng: false,
      onDisk: true,
    };

    const report = await runner({
      project,
      type: 'feature',
      goal,
      targetFiles,
      targetModule,
      proposedChanges,
      codeProducer: options?.codeProducer,
      runId: `eng-${workPackage.workPackageId}-${workPackage.attempt}`,
    });

    if (report.status === 'ready') {
      const criteria = [
        {
          criterion: `Controlled repository diff (${report.editStats.filesChanged} file(s) changed, +${report.editStats.linesAdded}/-${report.editStats.linesRemoved})`,
          status: 'VERIFIED' as const,
          evidenceRef: `diff://${report.runId}`,
        },
        {
          criterion: `Staged test execution (testsRan=${report.testsRan}, testsPassed=${report.testsPassed})`,
          status: report.testsPassed ? ('VERIFIED' as const) : ('FAILED' as const),
          evidenceRef: `test-evidence://${report.runId}`,
        },
        ...workPackage.taskIds.map((taskId) => ({
          criterion: `Task ${taskId} delivery evidence`,
          status: report.testsPassed ? ('VERIFIED' as const) : ('FAILED' as const),
          evidenceRef: `task-evidence://${taskId}/${report.runId}`,
        })),
      ];

      const artifact = parseContract(ArtifactContractSchema, {
        id: artifactId,
        schemaVersion: SCHEMA_VERSION,
        createdAt: now,
        updatedAt: now,
        metadata: {
          labels: {},
          annotations: {
            runId: report.runId,
            proposedDiff: report.proposedDiff,
            filesChanged: String(report.editStats.filesChanged),
            linesAdded: String(report.editStats.linesAdded),
            linesRemoved: String(report.editStats.linesRemoved),
            testsRan: String(report.testsRan),
            testsPassed: String(report.testsPassed),
            changeSet: JSON.stringify(report.changeSet),
            edits: JSON.stringify(report.edits),
            ...(citations.length > 0
              ? { memoryCitations: JSON.stringify(citations.map((c) => c.memoryId)) }
              : {}),
          },
        },
        kind: 'artifact',
        artifactId,
        artifactType: 'Code',
        version: `wp:${workPackage.workPackageId}:${workPackage.attempt}`,
        producedBy: mandate.contract.specialistId,
        producedFor: workPackage.execId,
        acceptanceStatus: 'submitted',
        acceptanceCriteriaMet: criteria,
        sourceTaskId: workPackage.taskIds[0],
        contentRef: `file://${report.runId}/PROPOSED_DIFF.patch`,
        contentHash: mandate.specHash,
      });

      const summary =
        `Implementation completed for ${workPackage.workPackageId}: ` +
        `${report.editStats.filesChanged} file(s) changed (+${report.editStats.linesAdded}/-${report.editStats.linesRemoved}), ` +
        `staged tests ${report.testsPassed ? 'passed' : report.testsRan ? 'failed' : 'not executed'}. ` +
        `Awaiting human review gate${citationNote}.`;

      return {
        summary,
        artifact,
        memoryCitations: citations,
        deliveryReport: report,
      };
    }
    // Delivery runner ran but could not mark package ready (e.g. scoping declined, tests failed, or syntax issues)
    const blockers = report.blockers ?? [];
    const artifact = parseContract(ArtifactContractSchema, {
      id: artifactId,
      schemaVersion: SCHEMA_VERSION,
      createdAt: now,
      updatedAt: now,
      metadata: {
        labels: {},
        annotations: {
          blockers: JSON.stringify(blockers),
          status: report.status,
          runId: report.runId,
          ...(citations.length > 0
            ? { memoryCitations: JSON.stringify(citations.map((c) => c.memoryId)) }
            : {}),
        },
      },
      kind: 'artifact',
      artifactId,
      artifactType: 'Code',
      version: `wp:${workPackage.workPackageId}:${workPackage.attempt}`,
      producedBy: mandate.contract.specialistId,
      producedFor: workPackage.execId,
      acceptanceStatus: 'draft',
      acceptanceCriteriaMet: workPackage.taskIds.map((taskId) => ({
        criterion: `Task ${taskId} delivery evidence`,
        status: 'N_A' as const,
      })),
      sourceTaskId: workPackage.taskIds[0],
      contentRef: `memory://artifacts/${artifactId}`,
      contentHash: mandate.specHash,
    });

    return {
      summary: `${workPackage.workPackageId} needs manual scoping — ${blockers.join('; ') || 'scoping declined'}${citationNote}`,
      artifact,
      memoryCitations: citations,
      deliveryReport: report,
    };
  }

  // Honest fallback when no change-set, ungrounded, or scoping declined without runner:
  const artifact = parseContract(ArtifactContractSchema, {
    id: artifactId,
    schemaVersion: SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    metadata: {
      labels: {},
      annotations:
        citations.length > 0
          ? { memoryCitations: JSON.stringify(citations.map((c) => c.memoryId)) }
          : {},
    },
    kind: 'artifact',
    artifactId,
    artifactType: 'Code',
    version: `wp:${workPackage.workPackageId}:${workPackage.attempt}`,
    producedBy: mandate.contract.specialistId,
    producedFor: workPackage.execId,
    acceptanceStatus: 'draft',
    acceptanceCriteriaMet: workPackage.taskIds.map((taskId) => ({
      criterion: `Task ${taskId} delivery evidence`,
      status: 'N_A' as const,
    })),
    sourceTaskId: workPackage.taskIds[0],
    contentRef: `memory://artifacts/${artifactId}`,
    contentHash: mandate.specHash,
  });

  return {
    summary: `${workPackage.workPackageId} needs manual scoping — no change-set was supplied, so no code was generated or verified${citationNote}`,
    artifact,
    memoryCitations: citations,
  };
}
