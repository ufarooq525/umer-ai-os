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
 * Produces a sealed Code artifact — no LLM calls.
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
    acceptanceStatus: 'submitted',
    acceptanceCriteriaMet: workPackage.taskIds.map((taskId) => ({
      criterion: `Task ${taskId} delivery evidence`,
      status: 'VERIFIED' as const,
      evidenceRef: `mem://runs/${workPackage.workPackageId}`,
    })),
    sourceTaskId: workPackage.taskIds[0],
    contentRef: `memory://artifacts/${artifactId}`,
    contentHash: mandate.specHash,
  });

  return {
    summary: `Engineering delivery completed for ${workPackage.workPackageId}${citationNote}`,
    artifact,
    memoryCitations: citations,
  };
}
