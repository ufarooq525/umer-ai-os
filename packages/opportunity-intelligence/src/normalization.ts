import type { DiscoveryCandidate } from './pipeline.js';

export type NormalizedBusinessCandidate = DiscoveryCandidate & {
  normalizedName: string;
  normalizedWebsite?: string;
  deduplicationKey: string;
};

export function normalizeWebsite(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    parsed.search = '';
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return undefined;
  }
}

export function normalizeBusinessName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function normalizeCandidate(candidate: DiscoveryCandidate): NormalizedBusinessCandidate {
  const normalizedName = normalizeBusinessName(candidate.name);
  const normalizedWebsite = normalizeWebsite(candidate.websiteUrl);
  const normalizedGeography = candidate.geography.trim().toLowerCase();
  const deduplicationKey = candidate.externalId?.trim()
    ? `external:${candidate.externalId.trim().toLowerCase()}`
    : normalizedWebsite
      ? `website:${normalizedWebsite}`
      : `name:${normalizedName}|geo:${normalizedGeography}`;

  return { ...candidate, normalizedName, normalizedWebsite, deduplicationKey };
}

export function deduplicateCandidates(candidates: DiscoveryCandidate[]): DiscoveryCandidate[] {
  const unique = new Map<string, NormalizedBusinessCandidate>();
  for (const candidate of candidates) {
    const normalized = normalizeCandidate(candidate);
    const existing = unique.get(normalized.deduplicationKey);
    if (!existing) {
      unique.set(normalized.deduplicationKey, normalized);
      continue;
    }
    unique.set(normalized.deduplicationKey, {
      ...existing,
      sourceRefs: [...new Set([...existing.sourceRefs, ...candidate.sourceRefs])],
      websiteUrl: existing.websiteUrl ?? candidate.websiteUrl,
      industry: existing.industry ?? candidate.industry,
    });
  }
  return [...unique.values()].map(({ normalizedName: _name, normalizedWebsite: _website, deduplicationKey: _key, ...candidate }) => candidate);
}
