import { describe, expect, it } from 'vitest';
import { normalizeMarket, rankMarketScan } from './market-scan';

describe('rankMarketScan', () => {
  it('skips a thin market even if every listing has no website', () => {
    const ranked = rankMarketScan({ listings: 2, withoutWebsite: 2, reviewMass: 8 });
    expect(ranked.skipReason).toMatch(/too thin/i);
    expect(ranked.rankScore).toBe(0);
    expect(ranked.vacuumPct).toBe(100);
  });

  it('ranks a vacuum with real listing volume above a wired market', () => {
    const vacuum = rankMarketScan({ listings: 16, withoutWebsite: 13, reviewMass: 200 });
    const wired = rankMarketScan({ listings: 16, withoutWebsite: 3, reviewMass: 200 });
    expect(vacuum.skipReason).toBeUndefined();
    expect(vacuum.rankScore).toBeGreaterThan(wired.rankScore);
    expect(vacuum.vacuumPct).toBe(81);
  });

  it('normalizes a custom market without inventing a city', () => {
    const market = normalizeMarket({ query: ' ticket office ', geography: ' Riyadh ', regionCode: 'SA' });
    expect(market.query).toBe('ticket office');
    expect(market.geography).toBe('Riyadh');
    expect(market.label).toBe('ticket office · Riyadh');
  });
});
