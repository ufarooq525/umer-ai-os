import type { DiscoveryCandidate } from './pipeline.js';
import { createBusinessId, normalizeBusinessName, normalizeWebsite } from './identity.js';

export type DeduplicationResult = {
  unique: DiscoveryCandidate[];
  duplicatesRemoved: number;
};

export function deduplicateCandidates(candidates: DiscoveryCandidate[]): DeduplicationResult {
  const unique = new Map<string, DiscoveryCandidate>();

  for (const candidate of candidates) {
    const normalizedWebsite = normalizeWebsite(candidate.websiteUrl);
    const identityKey = createBusinessId(candidate);
    const existing = unique.get(identityKey);

    if (!existing) {
      unique.set(identityKey, {
        ...candidate,
        name: candidate.name.trim(),
        websiteUrl: normalizedWebsite ?? candidate.websiteUrl,
        sourceRefs: [...new Set(candidate.sourceRefs)],
      });
      continue;
    }

    unique.set(identityKey, {
      ...existing,
      websiteUrl: existing.websiteUrl ?? normalizedWebsite ?? candidate.websiteUrl,
      industry: existing.industry ?? candidate.industry,
      sourceRefs: [...new Set([...existing.sourceRefs, ...candidate.sourceRefs])],
    });
  }

  return {
    unique: [...unique.values()],
    duplicatesRemoved: candidates.length - unique.size,
  };
}

export function candidateIdentityKey(candidate: DiscoveryCandidate): string {
  return createBusinessId({
    externalId: candidate.externalId,
    name: normalizeBusinessName(candidate.name),
    geography: candidate.geography,
    websiteUrl: candidate.websiteUrl,
  });
}
