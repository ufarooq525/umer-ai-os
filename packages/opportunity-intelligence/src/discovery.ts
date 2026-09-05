import type { NicheDefinition } from '@umer/contracts';

export type DiscoveryQuery = {
  niche: NicheDefinition;
  geography: string;
  query: string;
  limit: number;
  /** ISO country used by Places text search. Inferred from geography when omitted. */
  regionCode?: string;
};

export type BusinessCandidate = {
  externalId?: string;
  name: string;
  website?: string;
  geography: string;
  industry?: string;
  sourceRefs: string[];
  discoveredAt: string;
};

/**
 * Discovery is an adapter boundary. Providers can use search, directories,
 * approved APIs or other permitted public sources without coupling the domain
 * to a specific vendor or platform.
 */
export interface BusinessDiscoveryProvider {
  readonly name: string;
  discover(query: DiscoveryQuery): Promise<BusinessCandidate[]>;
}

export type DiscoveryResult = {
  provider: string;
  query: DiscoveryQuery;
  candidates: BusinessCandidate[];
};

export async function discoverBusinesses(
  provider: BusinessDiscoveryProvider,
  query: DiscoveryQuery,
): Promise<DiscoveryResult> {
  const candidates = await provider.discover(query);
  return { provider: provider.name, query, candidates };
}
