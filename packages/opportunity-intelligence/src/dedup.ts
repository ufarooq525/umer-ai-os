import type { DiscoveryCandidate } from './pipeline.js';
import { normalizeCandidate } from './normalization.js';

export type DeduplicationResult = {
  unique: DiscoveryCandidate[];
  duplicatesRemoved: number;
};

export function deduplicateCandidates(candidates: DiscoveryCandidate[]): DeduplicationResult {
  const unique = new Map<string, DiscoveryCandidate>();

  for (const candidate of candidates) {
    const normalized = normalizeCandidate(candidate);
    const existing = unique.get(normalized.deduplicationKey);

    if (!existing) {
      unique.set(normalized.deduplicationKey, {
        ...candidate,
        sourceRefs: [...new Set(candidate.sourceRefs)],
        ...(normalized.normalizedWebsite && !candidate.websiteUrl ? { websiteUrl: normalized.normalizedWebsite } : {}),
      });
      continue;
    }

    unique.set(normalized.deduplicationKey, {
      ...existing,
      websiteUrl: existing.websiteUrl ?? candidate.websiteUrl,
      industry: existing.industry ?? candidate.industry,
      sourceRefs: [...new Set([...existing.sourceRefs, ...candidate.sourceRefs])],
    });
  }

  return {
    unique: [...unique.values()],
    duplicatesRemoved: candidates.length - unique.size,
  };
}
