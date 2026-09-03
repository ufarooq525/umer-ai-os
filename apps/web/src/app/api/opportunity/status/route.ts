import { NextResponse } from 'next/server';
import { getOpportunityStatus } from '@/lib/opportunity-engine';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json(getOpportunityStatus(), { headers: { 'cache-control': 'no-store' } });
}
