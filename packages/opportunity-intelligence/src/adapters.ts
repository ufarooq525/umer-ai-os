import { createHash } from 'node:crypto';
import type { EvidenceRecord, NicheDefinition } from '@umer/contracts';
import type { BusinessDiscoveryProvider, BusinessCandidate, DiscoveryQuery } from './discovery.js';
import type { DiscoveryAdapter, DiscoveryCandidate, ResearchAdapter } from './pipeline.js';

export function inferPlacesRegion(geography: string): string {
  const value = geography.trim().toLocaleLowerCase();
  const pakistan = ['karachi', 'lahore', 'islamabad', 'faisalabad', 'peshawar', 'multan', 'rawalpindi', 'pakistan'];
  if (pakistan.some((city) => value.includes(city))) return 'PK';
  return 'SA';
}

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
 * Supports multi-query search across Saudi Arabia/Umrah geographies and subcategories.
 * Requires GOOGLE_MAPS_API_KEY on the server. No scraping is performed.
 */
export class GooglePlacesDiscoverySource implements DiscoverySource {
  readonly name = 'google-places';

  constructor(private readonly apiKey = process.env.GOOGLE_MAPS_API_KEY) {}

  async search(query: DiscoveryQuery): Promise<BusinessCandidate[]> {
    if (!this.apiKey) throw new Error('GOOGLE_MAPS_API_KEY is not configured; live discovery cannot start.');

    // Generate specialized sub-category search queries if discoverySignals exist in niche
    const searchQueries = this.buildSearchQueries(query);
    const candidates: BusinessCandidate[] = [];
    const pageSize = Math.max(1, Math.min(Math.ceil(query.limit / searchQueries.length), 20));

    for (const textQuery of searchQueries) {
      try {
        const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': this.apiKey,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.websiteUri,places.nationalPhoneNumber,places.internationalPhoneNumber,places.types,places.rating,places.userRatingCount,places.googleMapsUri,places.businessStatus',
          },
          body: JSON.stringify({
            textQuery,
            pageSize,
            languageCode: 'en',
            regionCode: query.regionCode ?? inferPlacesRegion(query.geography),
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
            rating?: number;
            userRatingCount?: number;
            googleMapsUri?: string;
            businessStatus?: string;
          }>;
        };

        const discoveredAt = new Date().toISOString();
        const items = (body.places ?? []).flatMap((place) => {
          const name = place.displayName?.text?.trim();
          if (!name) return [];
          const phone = place.internationalPhoneNumber || place.nationalPhoneNumber;
          const sourceRefs = [
            place.id ? `google-places:${place.id}` : 'google-places',
            ...(place.googleMapsUri ? [place.googleMapsUri] : []),
            ...(phone ? [`phone:${phone}`] : []),
            ...(place.formattedAddress ? [`address:${place.formattedAddress}`] : []),
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
        candidates.push(...items);
      } catch (err) {
        // Continue to next query if one fails, but log if needed
        if (searchQueries.length === 1) throw err;
      }
    }

    return candidates.slice(0, query.limit);
  }

  private buildSearchQueries(query: DiscoveryQuery): string[] {
    const base = `${query.niche.name} ${query.geography}`;
    if (!query.niche.discoverySignals || query.niche.discoverySignals.length === 0) {
      return [base];
    }
    // Pick top complementary discovery signals for the geography
    const specialized = query.niche.discoverySignals.slice(0, 3).map((sig) => `${sig} in ${query.geography}`);
    return [base, ...specialized];
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
        query: `${niche.name} in ${geography}`,
        limit: niche.targetBusinessesPerRun,
        regionCode: inferPlacesRegion(geography),
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
  /**
   * `priorEvidence` is everything already collected earlier in this same
   * research pass (sources run in array order). It lets a later, more
   * expensive/rate-limited source (e.g. SocialSearchEvidenceSource) decide
   * to skip work an earlier source already covered — see its own docstring.
   */
  collect(candidate: DiscoveryCandidate, niche?: NicheDefinition, priorEvidence?: EvidenceRecord[]): Promise<EvidenceRecord[]>;
};

export class EvidenceResearchAdapter implements ResearchAdapter {
  constructor(private readonly sources: EvidenceSource[], private readonly niche?: NicheDefinition) {}

  async research(candidate: DiscoveryCandidate): Promise<EvidenceRecord[]> {
    const evidence: EvidenceRecord[] = [];
    for (const source of this.sources) evidence.push(...await source.collect(candidate, this.niche, evidence));
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
 * Live first-party website and commercial signals research.
 * It inspects the public website URL and analyzes transactional readiness,
 * booking engine, payment flows, multilingual coverage, mobile accessibility, and CRM automation signals.
 */
export class WebsiteEvidenceSource implements EvidenceSource {
  readonly name = 'website';

  async collect(candidate: DiscoveryCandidate): Promise<EvidenceRecord[]> {
    if (!candidate.websiteUrl) {
      return [{
        id: evidenceId(candidate.name, 'no-website'),
        type: 'directory',
        title: 'Business listing without public website',
        sourceUrl: candidate.sourceRefs.find((ref) => ref.startsWith('http')) ?? 'https://www.google.com/maps',
        observedAt: new Date().toISOString(),
        observation: `${candidate.name} has a public listing but operates without a registered website domain, causing complete reliance on manual direct inquiries.`,
        strength: 'verified',
        supports: ['missing website', 'manual business process', 'conversion bottleneck'],
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
          id: evidenceId(candidate.name, 'website-status-unhealthy'),
          type: 'website',
          title: `Website returned HTTP ${response.status}`,
          sourceUrl: url.toString(),
          observedAt: new Date().toISOString(),
          observation: `${candidate.name} has a public website domain (${url.hostname}), but the server returned HTTP ${response.status}. Customers cannot access services online.`,
          strength: 'verified',
          supports: ['website reliability issue', 'unreachable digital front', 'lost conversion'],
          contradicts: [],
        }];
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.includes('text/html')) return [];
      const rawHtml = await response.text();
      const html = rawHtml.slice(0, 1_000_000);
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/\s+/g, ' ')
        .trim();
      const lower = text.toLocaleLowerCase();
      const excerpt = text.slice(0, 700);
      const records: EvidenceRecord[] = [];

      // 1. Transactional Booking & Commerce Signals
      const bookingKeywords = ['booking', 'reservation', 'book now', 'reserve', 'appointment', 'availability', 'schedule'];
      const paymentKeywords = ['payment', 'checkout', 'visa', 'mastercard', 'mada', 'apple pay', 'hyperpay', 'stripe', 'paytabs', 'tamara', 'tabby', 'credit card'];
      const conversionKeywords = ['contact form', 'request quote', 'get quote', 'inquire', 'whatsapp', 'call now', 'cta'];
      const automationKeywords = ['crm', 'portal', 'dashboard', 'autoresponder', 'automated confirmation', 'self-service', 'tracking'];
      const trustKeywords = ['license', 'ministry', 'hajj', 'umrah certified', 'accredited', 'reviews', 'testimonials', 'chamber of commerce', 'ratings'];

      const hasBooking = bookingKeywords.filter((k) => lower.includes(k));
      const hasPayments = paymentKeywords.filter((k) => lower.includes(k));
      const hasConversion = conversionKeywords.filter((k) => lower.includes(k));
      const hasAutomation = automationKeywords.filter((k) => lower.includes(k));
      const hasTrust = trustKeywords.filter((k) => lower.includes(k));

      // 2. Multilingual Support Signal (Arabic + English)
      const hasArabic = /[\u0600-\u06FF]/.test(rawHtml);
      const hasEnglish = /[a-zA-Z]{4,}/.test(text);
      const isBilingual = hasArabic && hasEnglish;

      // Primary Signal Record
      records.push({
        id: evidenceId(candidate.name, `${url.toString()}-signals`),
        type: 'website',
        title: 'Live website commercial audit',
        sourceUrl: url.toString(),
        observedAt: new Date().toISOString(),
        excerpt,
        observation: `${candidate.name} website audit: Booking signals [${hasBooking.length ? hasBooking.join(', ') : 'None'}], Payments [${hasPayments.length ? hasPayments.join(', ') : 'None'}], Inquiries [${hasConversion.length ? hasConversion.join(', ') : 'None'}], Automation [${hasAutomation.length ? hasAutomation.join(', ') : 'None'}]. Language coverage: ${isBilingual ? 'Bilingual (Arabic/English)' : hasArabic ? 'Arabic only' : 'English only'}.`,
        strength: 'verified',
        supports: [
          ...(hasBooking.length ? ['online booking supported'] : ['no online booking']),
          ...(hasPayments.length ? ['online payments supported'] : ['no online payments']),
          ...(hasAutomation.length ? ['automation present'] : ['missing automation']),
          ...(hasTrust.length ? ['trust signals present'] : []),
          ...(isBilingual ? ['bilingual support'] : ['missing multilingual localization']),
        ],
        contradicts: [],
      });

      // Specific Transactional Friction Record if booking or payments are missing
      if (hasBooking.length === 0 || hasPayments.length === 0) {
        records.push({
          id: evidenceId(candidate.name, `${url.toString()}-transactional-gap`),
          type: 'website',
          title: 'Manual commercial workflow friction',
          sourceUrl: url.toString(),
          observedAt: new Date().toISOString(),
          observation: `Prospective pilgrims/customers on ${candidate.name} cannot complete an automated transaction. ${hasBooking.length === 0 ? 'No online booking engine detected. ' : ''}${hasPayments.length === 0 ? 'No online checkout gateway (Mada/Visa/Mastercard) found. ' : ''}All bookings require manual contact.`,
          strength: 'verified',
          supports: ['manual workflow', 'conversion friction', 'high operational cost'],
          contradicts: [],
        });
      }

      // Multilingual Gap Record for international Umrah travelers
      if (!isBilingual) {
        records.push({
          id: evidenceId(candidate.name, `${url.toString()}-multilingual-gap`),
          type: 'website',
          title: 'Multilingual pilgrim accessibility gap',
          sourceUrl: url.toString(),
          observedAt: new Date().toISOString(),
          observation: `The website serves content in ${hasArabic ? 'Arabic only' : 'English only'}. International Umrah pilgrims across non-native language markets face language barriers when researching services.`,
          strength: 'verified',
          supports: ['multilingual gap', 'international pilgrim drop-off'],
          contradicts: [],
        });
      }

      // Social presence — GUARDRAIL: this reads only <a href> links the
      // business itself published on its own website (the exact page we
      // already fetched above for the audit). It never queries Facebook,
      // Instagram, X or LinkedIn directly, so it carries none of their
      // scraping/ToS exposure and needs no API key or credential.
      //
      // A link existing here means exactly that — a link exists on their
      // site — nothing more. It is NOT confirmation the account is active,
      // monitored, or still theirs. Every consumer of this evidence (UI,
      // future agents) MUST keep it labeled unverified and MUST NOT use it
      // to auto-send a message; that is why strength is 'moderate' (never
      // 'verified') and the observation says so explicitly below. This
      // guardrail is deliberate — do not bypass it by upgrading the
      // strength or dropping the caution text to make the record "cleaner".
      for (const [platform, profileUrl] of extractSocialLinks(rawHtml)) {
        records.push({
          id: evidenceId(candidate.name, `${url.toString()}-social-${platform}`),
          type: 'social_post',
          title: `${SOCIAL_LABEL[platform]} page linked from their website`,
          sourceUrl: profileUrl,
          observedAt: new Date().toISOString(),
          observation: `${candidate.name}'s own website links to a ${SOCIAL_LABEL[platform]} page (${profileUrl}). Unverified: this only confirms the link exists on their site, not that the account is still active or monitored — check it manually before treating it as a real channel.`,
          strength: 'moderate',
          supports: [`social presence: ${platform}`, 'alternate contact channel'],
          contradicts: [],
        });
      }

      return records;
    } catch (error) {
      return [{
        id: evidenceId(candidate.name, 'website-fetch-failed'),
        type: 'website',
        title: 'Website unreachable during audit',
        sourceUrl: url.toString(),
        observedAt: new Date().toISOString(),
        observation: `${candidate.name} website (${url.toString()}) could not be reached: ${error instanceof Error ? error.message : String(error)}.`,
        strength: 'moderate',
        supports: ['reachability gap', 'digital presence degradation'],
        contradicts: [],
      }];
    }
  }
}

export type SocialPlatform = 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'youtube' | 'tiktok';

export const SOCIAL_LABEL: Record<SocialPlatform, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  twitter: 'X/Twitter',
  linkedin: 'LinkedIn company',
  youtube: 'YouTube',
  tiktok: 'TikTok',
};

// Each pattern matches a real profile/page URL and excludes the generic
// share-button, login, and policy links every site embeds (e.g.
// facebook.com/sharer.php, instagram.com/accounts/login) which are not the
// business's own page and would be noise, not a contact channel.
const SOCIAL_PATTERNS: Array<{ platform: SocialPlatform; regex: RegExp; excludePath: RegExp }> = [
  { platform: 'facebook', regex: /https?:\/\/(?:www\.)?facebook\.com\/[^\s"'<>]+/gi, excludePath: /\/(sharer|dialog|plugins|tr|policies|help|legal|login|ads)(\/|\.|\?|$)/i },
  { platform: 'instagram', regex: /https?:\/\/(?:www\.)?instagram\.com\/[^\s"'<>]+/gi, excludePath: /\/(p|reel|reels|explore|accounts|developer)(\/|\?|$)/i },
  { platform: 'twitter', regex: /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[^\s"'<>]+/gi, excludePath: /\/(intent|share|i|home|hashtag)(\/|\?|$)/i },
  { platform: 'linkedin', regex: /https?:\/\/(?:www\.)?linkedin\.com\/company\/[^\s"'<>]+/gi, excludePath: /^$/ },
  { platform: 'youtube', regex: /https?:\/\/(?:www\.)?youtube\.com\/(?:channel|c|@|user)\/[^\s"'<>]+/gi, excludePath: /^$/ },
  { platform: 'tiktok', regex: /https?:\/\/(?:www\.)?tiktok\.com\/@[^\s"'<>]+/gi, excludePath: /^$/ },
];

/**
 * Classifies a single URL as a real social profile/page link, or null if it
 * isn't one of the supported platforms or is a share/login/policy link
 * rather than an actual page. Shared by the HTML scanner below and by the
 * search-based fallback (social-search.ts) so both apply the identical
 * "what counts as a real profile link" rule.
 */
export function classifySocialUrl(rawUrl: string): { platform: SocialPlatform; url: string } | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  if (parsed.pathname === '/' || parsed.pathname === '') return null;
  for (const { platform, regex, excludePath } of SOCIAL_PATTERNS) {
    if (!new RegExp(regex.source, 'i').test(parsed.toString())) continue;
    if (excludePath.test(parsed.pathname)) return null;
    return { platform, url: parsed.toString() };
  }
  return null;
}

/**
 * Extracts social profile links from raw HTML the business itself published
 * on its own website — see the guardrail comment at the call site. Returns
 * at most one URL per platform (the first found), trimmed of trailing HTML
 * punctuation that a greedy match can pick up.
 */
export function extractSocialLinks(html: string): Array<[SocialPlatform, string]> {
  const found = new Map<SocialPlatform, string>();
  for (const { platform, regex } of SOCIAL_PATTERNS) {
    if (found.has(platform)) continue;
    regex.lastIndex = 0;
    for (const match of html.matchAll(regex)) {
      const raw = match[0].replace(/[),.;]+$/, '');
      const classified = classifySocialUrl(raw);
      if (!classified || classified.platform !== platform) continue;
      found.set(platform, classified.url);
      break;
    }
  }
  return [...found.entries()];
}

function evidenceId(business: string, source: string): string {
  return createHash('sha256').update(`${business}|${source}`).digest('hex');
}

function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true;
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) return true;
  const match = host.match(/^172\.(\d{1,2})\./);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}
