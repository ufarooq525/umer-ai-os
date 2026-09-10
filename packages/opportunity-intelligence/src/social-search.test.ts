import { afterEach, describe, expect, it, vi } from 'vitest';
import { DailySearchBudget, SocialSearchEvidenceSource, type RedisLike } from './social-search.js';
import type { DiscoveryCandidate } from './pipeline.js';
import type { EvidenceRecord } from '@umer/contracts';

function fakeRedis(): RedisLike & { store: Map<string, number> } {
  const store = new Map<string, number>();
  return {
    store,
    async incr(key) {
      const next = (store.get(key) ?? 0) + 1;
      store.set(key, next);
      return next;
    },
    async decr(key) {
      const next = (store.get(key) ?? 0) - 1;
      store.set(key, next);
      return next;
    },
    async expire() {
      return 1;
    },
    async get(key) {
      const value = store.get(key);
      return value === undefined ? null : String(value);
    },
  };
}

describe('DailySearchBudget', () => {
  it('allows consumption up to the limit and rejects after', async () => {
    const budget = new DailySearchBudget(fakeRedis(), 3);
    expect(await budget.tryConsume()).toBe(true);
    expect(await budget.tryConsume()).toBe(true);
    expect(await budget.tryConsume()).toBe(true);
    expect(await budget.tryConsume()).toBe(false);
  });

  it('does not count a rejected attempt against the budget', async () => {
    const redis = fakeRedis();
    const budget = new DailySearchBudget(redis, 1);
    expect(await budget.tryConsume()).toBe(true);
    expect(await budget.tryConsume()).toBe(false);
    expect(await budget.tryConsume()).toBe(false);
    expect(await budget.remainingToday()).toBe(0);
  });

  it('defaults to a 60/day cap — below Google CSE\'s 100/day free tier', async () => {
    const budget = new DailySearchBudget(fakeRedis());
    expect(await budget.remainingToday()).toBe(60);
  });
});

const candidate: DiscoveryCandidate = {
  name: 'Al-Haramain VIP Transport',
  geography: 'Makkah',
  websiteUrl: undefined,
  sourceRefs: [],
};

const cseResponse = (links: string[]) => ({
  ok: true,
  json: async () => ({ items: links.map((link) => ({ link })) }),
});

describe('SocialSearchEvidenceSource', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is a silent no-op when not configured', async () => {
    const source = new SocialSearchEvidenceSource(undefined, undefined);
    expect(await source.collect(candidate)).toEqual([]);
  });

  it('skips the search entirely when prior evidence already has a social link', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const source = new SocialSearchEvidenceSource('key', 'cx');
    const prior: EvidenceRecord[] = [{
      id: 'ev-1',
      type: 'social_post',
      title: 'x',
      sourceUrl: 'https://facebook.com/x',
      observedAt: new Date().toISOString(),
      observation: 'x',
      strength: 'moderate',
    }];
    expect(await source.collect(candidate, undefined, prior)).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('respects the daily budget and skips the call once exhausted', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const budget = new DailySearchBudget(fakeRedis(), 0);
    const source = new SocialSearchEvidenceSource('key', 'cx', budget);
    expect(await source.collect(candidate)).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('marks every result as unverified with strength capped at weak', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(cseResponse([
      'https://www.facebook.com/al-haramain-transport',
      'https://www.facebook.com/sharer.php?u=x', // excluded — not a profile link
    ])));
    const source = new SocialSearchEvidenceSource('key', 'cx');
    const records = await source.collect(candidate);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ type: 'social_post', strength: 'weak' });
    expect(records[0]!.observation).toMatch(/unverified/i);
  });

  it('returns nothing on a failed request instead of throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    const source = new SocialSearchEvidenceSource('key', 'cx');
    await expect(source.collect(candidate)).resolves.toEqual([]);
  });
});
