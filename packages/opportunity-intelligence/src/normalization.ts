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
  return name
    .trim()
    .toLocaleLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeCandidate(candidate: DiscoveryCandidate): NormalizedBusinessCandidate {
  const normalizedName = normalizeBusinessName(candidate.name);
  const normalizedWebsite = normalizeWebsite(candidate.websiteUrl);
  const normalizedGeography = candidate.geography.trim().toLocaleLowerCase().normalize('NFKC');
  const deduplicationKey = candidate.externalId?.trim()
    ? `external:${candidate.externalId.trim().toLocaleLowerCase()}`
    : normalizedWebsite
      ? `website:${normalizedWebsite}`
      : `name:${normalizedName}|geo:${normalizedGeography}`;

  return { ...candidate, normalizedName, normalizedWebsite, deduplicationKey };
}
