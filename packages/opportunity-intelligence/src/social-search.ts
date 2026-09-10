import { createHash } from 'node:crypto';
import type { EvidenceRecord, NicheDefinition } from '@umer/contracts';
import type { DiscoveryCandidate } from './pipeline.js';
import type { EvidenceSource } from './adapters.js';
import { SOCIAL_LABEL, classifySocialUrl } from './adapters.js';

/**
 * The minimum Redis surface this needs — a structural type rather than
 * importing ioredis directly, so this package doesn't take on a new
 * dependency just to count to 60. `createRedisClient()` from `@umer/db`
 * satisfies this without any adapter code.
 */
export type RedisLike = {
  incr(key: string): Promise<number>;
  decr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  get(key: string): Promise<string | null>;
};

/**
 * A hard daily cap on Google Custom Search calls, enforced in Redis so it
 * holds across process restarts and concurrent research runs.
 *
 * GUARDRAIL — do not bypass: the account's free tier is 100 queries/day.
 * The default here is deliberately lower (60), leaving headroom so a
 * slow day never risks tipping into Google's paid tier by accident. Raise
 * the limit only with an explicit, intentional decision — never as a
 * quiet fix for "budget exhausted" log noise.
 */
export class DailySearchBudget {
  constructor(
    private readonly redis: RedisLike,
    private readonly limit = 60,
    private readonly keyPrefix = 'social-search-budget',
  ) {}

  private todayKey(): string {
    const day = new Date().toISOString().slice(0, 10); // UTC calendar day
    return `${this.keyPrefix}:${day}`;
  }

  /** Atomically consumes one unit of today's budget. Returns false once the cap is hit. */
  async tryConsume(): Promise<boolean> {
    const key = this.todayKey();
    const count = await this.redis.incr(key);
    if (count === 1) {
      // ~26h TTL: a couple of hours of slack past UTC midnight so a slightly
      // delayed key creation can't leave a stale counter alive into the next day.
      await this.redis.expire(key, 26 * 60 * 60);
    }
    if (count > this.limit) {
      await this.redis.decr(key); // a rejected attempt shouldn't itself count against the budget
      return false;
    }
    return true;
  }

  async remainingToday(): Promise<number> {
    const raw = await this.redis.get(this.todayKey());
    return Math.max(0, this.limit - Number(raw ?? 0));
  }
}

function evidenceId(business: string, source: string): string {
  return createHash('sha256').update(`${business}|${source}`).digest('hex');
}

type GoogleCseResponse = {
  items?: Array<{ link?: string; title?: string; displayLink?: string }>;
};

/**
 * Fallback social-profile discovery via Google Custom Search — the paid-tier
 * replacement for manually Googling a business when its website has no
 * social links (or no website at all). Only runs when:
 *   1. GOOGLE_CSE_API_KEY / GOOGLE_CSE_CX are configured (silently a no-op
 *      otherwise — this is an optional enrichment, never a hard dependency).
 *   2. The website scan (WebsiteEvidenceSource, which must run first in the
 *      source list) hasn't already found a social link for this business —
 *      saves quota on the common case where the site's own footer has it.
 *   3. The daily budget has room (see DailySearchBudget) — silently skips
 *      once exhausted rather than erroring the whole research run.
 *
 * GUARDRAIL — do not bypass: a search result matching a business by name
 * carries a real risk of finding a *different* business with a similar or
 * identical name (much less certain than a link literally embedded on the
 * target's own website). Every record this produces is therefore capped at
 * strength 'weak' — one level below the website-derived 'moderate' — and
 * the observation spells out that the match is unverified and may not even
 * be the right business. Do not raise the strength to make results look
 * more trustworthy than a name-match search actually is.
 */
export class SocialSearchEvidenceSource implements EvidenceSource {
  readonly name = 'social-search';

  constructor(
    private readonly apiKey = process.env.GOOGLE_CSE_API_KEY,
    private readonly cx = process.env.GOOGLE_CSE_CX,
    private readonly budget?: DailySearchBudget,
  ) {}

  async collect(candidate: DiscoveryCandidate, _niche?: NicheDefinition, priorEvidence: EvidenceRecord[] = []): Promise<EvidenceRecord[]> {
    if (!this.apiKey || !this.cx) return [];
    if (priorEvidence.some((record) => record.type === 'social_post')) return [];

    if (this.budget) {
      const allowed = await this.budget.tryConsume();
      if (!allowed) return [];
    }

    const query = `"${candidate.name}" ${candidate.geography} (facebook.com OR instagram.com OR linkedin.com/company)`;
    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.searchParams.set('key', this.apiKey);
    url.searchParams.set('cx', this.cx);
    url.searchParams.set('q', query);
    url.searchParams.set('num', '5');

    let body: GoogleCseResponse;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!response.ok) return [];
      body = (await response.json()) as GoogleCseResponse;
    } catch {
      return [];
    }

    const found = new Map<string, { platform: string; url: string }>();
    for (const item of body.items ?? []) {
      if (!item.link) continue;
      const classified = classifySocialUrl(item.link);
      if (!classified || found.has(classified.platform)) continue;
      found.set(classified.platform, classified);
    }

    return [...found.values()].map(({ platform, url: profileUrl }) => ({
      id: evidenceId(candidate.name, `social-search-${platform}`),
      type: 'social_post' as const,
      title: `${SOCIAL_LABEL[platform as keyof typeof SOCIAL_LABEL]} profile found via search`,
      sourceUrl: profileUrl,
      observedAt: new Date().toISOString(),
      observation: `A search for "${candidate.name}" in ${candidate.geography} returned a ${SOCIAL_LABEL[platform as keyof typeof SOCIAL_LABEL]} result (${profileUrl}). Unverified and lower-confidence than a link found on their own website: this only confirms a name match in search results, not that the page belongs to this exact business or that it's active — verify manually before using it as a contact channel.`,
      strength: 'weak' as const,
      supports: [`social presence via search: ${platform}`],
      contradicts: [],
    }));
  }
}
