import type { DiscoveryCandidate } from './pipeline.js';

export type DeduplicationResult = {
  unique: DiscoveryCandidate[];
  duplicatesRemoved: number;
};

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
}

function key(candidate: DiscoveryCandidate): string {
  if (candidate.externalId) return `id:${normalize(candidate.externalId)}`;
  if (candidate.websiteUrl) return `url:${normalize(candidate.websiteUrl)}`;
  return `name:${normalize(candidate.name)}|geo:${normalize(candidate.geography)}`;
}

export function deduplicateCandidates(candidates: DiscoveryCandidate[]): DeduplicationResult {
  const seen = new Set<string>();
  const unique: DiscoveryCandidate[] = [];

  for (const candidate of candidates) {
    const candidateKey = key(candidate);
    if (seen.has(candidateKey)) continue;
    seen.add(candidateKey);
    unique.push({ ...candidate, sourceRefs: [...new Set(candidate.sourceRefs)] });
  }

  return { unique, duplicatesRemoved: candidates.length - unique.length };
}
