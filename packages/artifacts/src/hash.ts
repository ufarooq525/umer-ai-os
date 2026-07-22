import { createHash } from 'node:crypto';
import type { ArtifactContract } from '@umer/contracts';

export function isArtifactImmutable(artifact: ArtifactContract): boolean {
  return artifact.acceptanceStatus === 'submitted' || artifact.acceptanceStatus === 'accepted';
}

export function computeArtifactContentHash(artifact: ArtifactContract): string {
  const payload = JSON.stringify({
    artifactId: artifact.artifactId,
    artifactType: artifact.artifactType,
    version: artifact.version,
    producedBy: artifact.producedBy,
    producedFor: artifact.producedFor,
    acceptanceCriteriaMet: artifact.acceptanceCriteriaMet,
    contentRef: artifact.contentRef,
    contentHash: artifact.contentHash,
  });
  return createHash('sha256').update(payload).digest('hex');
}
