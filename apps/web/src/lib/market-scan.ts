export type MarketPreset = {
  id: string;
  label: string;
  query: string;
  geography: string;
  regionCode: 'SA' | 'PK';
};

export type MarketScanResult = {
  id: string;
  label: string;
  query: string;
  geography: string;
  regionCode: 'SA' | 'PK';
  listings: number;
  withWebsite: number;
  withoutWebsite: number;
  vacuumPct: number;
  reviewMass: number;
  rankScore: number;
  skipReason?: string;
  sampleNames: string[];
  mode: 'LIVE_GOOGLE_PLACES' | 'LOCAL_FALLBACK';
};

export const MARKET_PRESETS: MarketPreset[] = [
  { id: 'umrah-makkah', label: 'Umrah agencies', query: 'Umrah travel agency', geography: 'Makkah', regionCode: 'SA' },
  { id: 'umrah-transport', label: 'Umrah transport', query: 'Umrah transport', geography: 'Jeddah', regionCode: 'SA' },
  { id: 'tickets-riyadh', label: 'Ticket offices', query: 'ticket office', geography: 'Riyadh', regionCode: 'SA' },
  { id: 'events-jeddah', label: 'Event tickets', query: 'event tickets', geography: 'Jeddah', regionCode: 'SA' },
  { id: 'travel-karachi', label: 'Travel agencies', query: 'travel agency', geography: 'Karachi', regionCode: 'PK' },
  { id: 'tickets-lahore', label: 'Ticket shops', query: 'ticket shop', geography: 'Lahore', regionCode: 'PK' },
];

const FALLBACK: Record<string, Pick<MarketScanResult, 'listings' | 'withWebsite' | 'withoutWebsite' | 'reviewMass' | 'sampleNames'>> = {
  'umrah-makkah': { listings: 18, withWebsite: 7, withoutWebsite: 11, reviewMass: 420, sampleNames: ['Sample Umrah desk', 'Makkah operator'] },
  'umrah-transport': { listings: 12, withWebsite: 4, withoutWebsite: 8, reviewMass: 210, sampleNames: ['Jeddah fleet'] },
  'tickets-riyadh': { listings: 15, withWebsite: 3, withoutWebsite: 12, reviewMass: 180, sampleNames: ['Riyadh ticket counter'] },
  'events-jeddah': { listings: 9, withWebsite: 4, withoutWebsite: 5, reviewMass: 95, sampleNames: ['Jeddah box office'] },
  'travel-karachi': { listings: 16, withWebsite: 6, withoutWebsite: 10, reviewMass: 310, sampleNames: ['Karachi travel desk'] },
  'tickets-lahore': { listings: 8, withWebsite: 2, withoutWebsite: 6, reviewMass: 70, sampleNames: ['Lahore ticket shop'] },
};

export function rankMarketScan(input: {
  listings: number;
  withoutWebsite: number;
  reviewMass: number;
  minListings?: number;
}): { vacuumPct: number; rankScore: number; skipReason?: string } {
  const minListings = input.minListings ?? 5;
  const vacuumPct = input.listings === 0 ? 0 : Math.round((input.withoutWebsite / input.listings) * 100);
  if (input.listings < minListings) {
    return { vacuumPct, rankScore: 0, skipReason: `Only ${input.listings} listings — too thin to call a market.` };
  }
  const rankScore = Math.round(vacuumPct * Math.log10(input.listings + 1) * Math.log10(input.reviewMass + 10));
  return { vacuumPct, rankScore };
}

type PlaceHit = { name: string; website?: string; reviews: number };

async function searchPlaces(query: string, regionCode: string, apiKey: string, pageSize = 12): Promise<PlaceHit[]> {
  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.displayName,places.websiteUri,places.userRatingCount',
    },
    body: JSON.stringify({
      textQuery: query,
      pageSize,
      languageCode: 'en',
      regionCode,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Google Places scan failed (${response.status}): ${detail.slice(0, 240)}`);
  }
  const body = (await response.json()) as {
    places?: Array<{ displayName?: { text?: string }; websiteUri?: string; userRatingCount?: number }>;
  };
  return (body.places ?? []).flatMap((place) => {
    const name = place.displayName?.text?.trim();
    if (!name) return [];
    return [{ name, website: place.websiteUri, reviews: place.userRatingCount ?? 0 }];
  });
}

export async function scanMarket(preset: MarketPreset): Promise<MarketScanResult> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  const textQuery = `${preset.query} ${preset.geography}`;

  if (!apiKey) {
    const fb = FALLBACK[preset.id] ?? { listings: 6, withWebsite: 2, withoutWebsite: 4, reviewMass: 40, sampleNames: [] };
    const ranked = rankMarketScan(fb);
    return {
      ...preset,
      ...fb,
      ...ranked,
      mode: 'LOCAL_FALLBACK',
    };
  }

  const hits = await searchPlaces(textQuery, preset.regionCode, apiKey);
  const listings = hits.length;
  const withWebsite = hits.filter((h) => Boolean(h.website)).length;
  const withoutWebsite = listings - withWebsite;
  const reviewMass = hits.reduce((sum, h) => sum + h.reviews, 0);
  const ranked = rankMarketScan({ listings, withoutWebsite, reviewMass });
  return {
    ...preset,
    listings,
    withWebsite,
    withoutWebsite,
    reviewMass,
    sampleNames: hits.slice(0, 3).map((h) => h.name),
    mode: 'LIVE_GOOGLE_PLACES',
    ...ranked,
  };
}

export async function scanMarkets(presets: MarketPreset[]): Promise<MarketScanResult[]> {
  const results: MarketScanResult[] = [];
  for (const preset of presets) {
    results.push(await scanMarket(preset));
  }
  return [...results].sort((a, b) => b.rankScore - a.rankScore);
}

export function normalizeMarket(input: {
  id?: string;
  label?: string;
  query: string;
  geography: string;
  regionCode?: 'SA' | 'PK' | string;
}): MarketPreset {
  const query = input.query.trim();
  const geography = input.geography.trim();
  if (!query || !geography) {
    throw new Error('A market needs a search query and a city.');
  }
  const regionCode = input.regionCode === 'PK' ? 'PK' : 'SA';
  const id = input.id?.trim() || `custom-${query}-${geography}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return {
    id,
    label: input.label?.trim() || `${query} · ${geography}`,
    query,
    geography,
    regionCode,
  };
}
