import { NextResponse } from 'next/server';
import { MARKET_PRESETS, normalizeMarket, scanMarkets, type MarketPreset } from '@/lib/market-scan';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({ presets: MARKET_PRESETS });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { markets?: MarketPreset[] };
  try {
    const markets = body.markets?.length ? body.markets.map((market) => normalizeMarket(market)) : MARKET_PRESETS;
    const results = await scanMarkets(markets);
    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Scan failed' }, { status: 502 });
  }
}
