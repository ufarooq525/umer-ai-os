import {
  parseContract,
  SCHEMA_VERSION,
  ArtifactContractSchema,
  type ArtifactContract,
  type WorkPackageContract,
} from '@umer/contracts';
import type { SpecialistMandate } from '@umer/specialist-sdk';
import type { RetrievalBundle } from '@umer/memory-access';

export type SpecialistRunResult = {
  summary: string;
  artifact: ArtifactContract;
  memoryCitations?: RetrievalBundle['citations'];
};

/**
 * Deterministic Engineering Specialist handler for M6.
 *
 * `WorkPackageContractSchema` carries no change-set/target-files field —
 * there has never been a real path for one to reach this handler — so this
 * cannot actually scope, diff, or apply anything. It used to claim
 * `acceptanceStatus: 'submitted'` with every criterion `VERIFIED` regardless
 * of that, which fabricated a completed-and-verified delivery for work that
 * never happened; a human reviewing the resulting Gate would see "delivery
 * completed" with no real diff or test run behind it. Fixed to report
 * exactly what did (not) happen: no LLM calls, no code generation — the
 * artifact is `draft` with `N_A` criteria, matching the mandate's own
 * "needs-manual-scoping" behavior for a missing change-set (see
 * specialists/engineering/application-delivery.md's Decision Rules).
 */
export async function runEngineeringApplicationDelivery(
  workPackage: WorkPackageContract,
  mandate: SpecialistMandate,
  options?: { retrievalBundle?: RetrievalBundle },
): Promise<SpecialistRunResult> {
  const now = new Date().toISOString();
  const artifactId = `art-${workPackage.workPackageId}-${workPackage.attempt}`;

  const citations = options?.retrievalBundle?.citations ?? [];
  const citationNote =
    citations.length > 0
      ? ` (${citations.length} organizational lesson${citations.length === 1 ? '' : 's'} cited)`
      : '';

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
