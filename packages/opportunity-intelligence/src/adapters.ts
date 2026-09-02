import { createHash } from 'node:crypto';
import type { EvidenceRecord, NicheDefinition } from '@umer/contracts';
import type { BusinessDiscoveryProvider, BusinessCandidate, DiscoveryQuery } from './discovery.js';
import type { DiscoveryAdapter, DiscoveryCandidate, ResearchAdapter } from './pipeline.js';

/** Provider-neutral normalized discovery source. Real vendors can implement this contract without entering domain code. */
export type DiscoverySource = {
  readonly name: string;
  search(query: DiscoveryQuery): Promise<BusinessCandidate[]>;
};

export class SourceDiscoveryProvider implements BusinessDiscoveryProvider {
  readonly name: string;

  constructor(private readonly sources: DiscoverySource[], name = 'composite-discovery') {
    this.name = name;
  }

  async discover(query: DiscoveryQuery): Promise<BusinessCandidate[]> {
    const results: BusinessCandidate[] = [];
    for (const source of this.sources) results.push(...await source.search(query));
    return results;
  }
}

/** Deterministic adapter for fixtures, imports and local development. */
export class StaticDiscoverySource implements DiscoverySource {
  readonly name = 'static';

  constructor(private readonly candidates: BusinessCandidate[]) {}

  async search(query: DiscoveryQuery): Promise<BusinessCandidate[]> {
    const geography = query.geography.trim().toLocaleLowerCase();
    return this.candidates.filter((candidate) => {
      const candGeo = candidate.geography.trim().toLocaleLowerCase();
      return candGeo === geography || candGeo.includes(geography) || geography.includes(candGeo);
    });
  }
}

/**
 * Live Google Places Text Search (New) source.
 * Requires GOOGLE_MAPS_API_KEY on the server. No scraping is performed.
 */
export class GooglePlacesDiscoverySource implements DiscoverySource {
  readonly name = 'google-places';

  constructor(private readonly apiKey = process.env.GOOGLE_MAPS_API_KEY) {}

  async search(query: DiscoveryQuery): Promise<BusinessCandidate[]> {
    if (!this.apiKey) throw new Error('GOOGLE_MAPS_API_KEY is not configured; live discovery cannot start.');

    const limit = Math.max(1, Math.min(query.limit, 20));
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.websiteUri,places.nationalPhoneNumber,places.internationalPhoneNumber,places.types,places.googleMapsUri',
      },
      body: JSON.stringify({
        textQuery: query.query,
        pageSize: limit,
        languageCode: 'en',
        regionCode: 'SA',
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Google Places request failed (${response.status}): ${detail.slice(0, 500)}`);
    }

    const body = (await response.json()) as {
      places?: Array<{
        id?: string;
        displayName?: { text?: string };
        formattedAddress?: string;
        websiteUri?: string;
        nationalPhoneNumber?: string;
        internationalPhoneNumber?: string;
        types?: string[];
        googleMapsUri?: string;
      }>;
    };
    const discoveredAt = new Date().toISOString();

    return (body.places ?? []).slice(0, limit).flatMap((place) => {
      const name = place.displayName?.text?.trim();
      if (!name) return [];
      const sourceRefs = [
        place.id ? `google-places:${place.id}` : 'google-places',
        ...(place.googleMapsUri ? [place.googleMapsUri] : []),
      ];
      return [{
        externalId: place.id ? `google:${place.id}` : undefined,
        name,
        website: place.websiteUri,
        geography: query.geography,
        industry: place.types?.[0]?.replaceAll('_', ' '),
        sourceRefs: [...new Set(sourceRefs)],
        discoveredAt,
      }];
    });
  }
}

export class CompositeDiscoveryAdapter implements DiscoveryAdapter {
  constructor(private readonly provider: BusinessDiscoveryProvider) {}

  async discover(niche: NicheDefinition): Promise<DiscoveryCandidate[]> {
    const all: DiscoveryCandidate[] = [];
    for (const geography of niche.geographies) {
      const results = await this.provider.discover({
        niche,
        geography,
        query: `${niche.name} ${geography}`,
        limit: niche.targetBusinessesPerRun,
      });
      all.push(...results.map((item) => ({
        externalId: item.externalId,
        name: item.name,
        geography: item.geography || geography,
        industry: item.industry,
        websiteUrl: item.website,
        sourceRefs: [...new Set(item.sourceRefs)],
      })));
    }
    return all;
  }
}

export type EvidenceSource = {
  readonly name: string;
  collect(candidate: DiscoveryCandidate, niche?: NicheDefinition): Promise<EvidenceRecord[]>;
};

export class EvidenceResearchAdapter implements ResearchAdapter {
  constructor(private readonly sources: EvidenceSource[], private readonly niche?: NicheDefinition) {}

  async research(candidate: DiscoveryCandidate): Promise<EvidenceRecord[]> {
    const evidence: EvidenceRecord[] = [];
    for (const source of this.sources) evidence.push(...await source.collect(candidate, this.niche));
    const unique = new Map<string, EvidenceRecord>();
    for (const item of evidence) unique.set(item.id, item);
    return [...unique.values()];
  }
}

export class StaticEvidenceSource implements EvidenceSource {
  readonly name = 'static';

  constructor(private readonly records: EvidenceRecord[]) {}

  async collect(candidate: DiscoveryCandidate): Promise<EvidenceRecord[]> {
    const name = candidate.name.trim().toLocaleLowerCase();
    const website = candidate.websiteUrl?.trim().toLocaleLowerCase();
    return this.records.filter((record) => {
      const haystack = `${record.title} ${record.sourceUrl} ${record.observation} ${record.excerpt ?? ''}`.toLocaleLowerCase();
      return haystack.includes(name) || (website ? haystack.includes(website) || website.includes(record.sourceUrl.toLocaleLowerCase()) : false);
    });
  }
}

/**
 * Live first-party website research. It fetches only the public website URL
 * returned by the discovery provider and turns observable signals into evidence.
 */
export class WebsiteEvidenceSource implements EvidenceSource {
  readonly name = 'website';

  async collect(candidate: DiscoveryCandidate): Promise<EvidenceRecord[]> {
    if (!candidate.websiteUrl) {
      return [{
        id: evidenceId(candidate.name, 'no-website'),
        type: 'directory',
        title: 'Business listing without website',
        sourceUrl: candidate.sourceRefs.find((ref) => ref.startsWith('http')) ?? 'https://www.google.com/maps',
        observedAt: new Date().toISOString(),
        observation: `${candidate.name} was discovered as a public business listing but no website URL was returned.`,
        strength: 'strong',
        supports: ['weak digital presence'],
        contradicts: [],
      }];
    }

    let url: URL;
    try {
      url = new URL(candidate.websiteUrl);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('unsupported protocol');
      if (isPrivateHostname(url.hostname)) throw new Error('private hostname');
    } catch {
      return [];
    }

    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: { 'user-agent': 'UmerAIOS-OpportunityResearch/1.0' },
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) {
        return [{
          id: evidenceId(candidate.name, 'website-status'),
          type: 'website',
          title: `Website returned HTTP ${response.status}`,
          sourceUrl: url.toString(),
          observedAt: new Date().toISOString(),
          observation: `${candidate.name} has a public website URL, but the page returned HTTP ${response.status}.`,
          strength: 'verified',
          supports: ['website reliability issue'],
          contradicts: [],
        }];
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.includes('text/html')) return [];
      const html = (await response.text()).slice(0, 1_000_000);
      const text = html
        .replace(/<script[\\s\\S]*?<\\/script>/gi, ' ')
        .replace(/<style[\\s\\S]*?<\\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/\\s+/g, ' ')
        .trim();
      const lower = text.toLocaleLowerCase();
      const signals = [
        ['booking', 'booking'], ['reservation', 'reservation'], ['appointment', 'appointment'],
        ['checkout', 'checkout'], ['payment', 'payment'], ['visa', 'visa'], ['mastercard', 'mastercard'],
        ['whatsapp', 'WhatsApp'], ['contact form', 'contact form'], ['request a quote', 'request a quote'],
        ['crm', 'CRM'], ['follow-up', 'follow-up'], ['follow up', 'follow-up'], ['automation', 'automation'],
        ['reviews', 'reviews'], ['testimonials', 'testimonials'], ['rating', 'rating'],
      ] as const;
      const found = signals.filter(([needle]) => lower.includes(needle)).map(([, label]) => label);
      const missing = signals.filter(([needle]) => !lower.includes(needle)).map(([, label]) => label);
      const excerpt = text.slice(0, 700);

      return [{
        id: evidenceId(candidate.name, url.toString()),
        type: 'website',
        title: 'Live website commercial signal scan',
        sourceUrl: url.toString(),
        observedAt: new Date().toISOString(),
        excerpt,
        observation: `${candidate.name} live website scan found: ${found.length ? found.join(', ') : 'no common commercial workflow signals'}. Missing common signals: ${missing.slice(0, 8).join(', ') || 'none detected'}.`,
        strength: 'verified',
        supports: found,
        contradicts: [],
      }];
    } catch (error) {
      return [{
        id: evidenceId(candidate.name, 'website-fetch-failed'),
        type: 'website',
        title: 'Website could not be researched',
        sourceUrl: url.toString(),
        observedAt: new Date().toISOString(),
        observation: `${candidate.name} has a website URL but live research failed: ${error instanceof Error ? error.message : String(error)}.`,
        strength: 'moderate',
        supports: ['research gap'],
        contradicts: [],
      }];
    }
  }
}

function evidenceId(business: string, source: string): string {
  return createHash('sha256').update(`${business}|${source}`).digest('hex');
}

function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true;
  if (/^127\\./.test(host) || /^10\\./.test(host) || /^192\\.168\\./.test(host)) return true;
  const match = host.match(/^172\\.(\\d{1,2})\\./);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}
