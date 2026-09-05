import { NextResponse } from 'next/server';
import { startOpportunityRun } from '@/lib/opportunity-engine';
import type { MarketPreset } from '@/lib/market-scan';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { market?: MarketPreset };
  try {
    return NextResponse.json(startOpportunityRun(body.market), { status: 202 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Run failed' }, { status: 400 });
  }
}
