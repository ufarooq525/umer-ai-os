import { NextResponse } from 'next/server';
import { startOpportunityRun } from '@/lib/opportunity-engine';

export const dynamic = 'force-dynamic';

export async function POST() {
  return NextResponse.json(startOpportunityRun(), { status: 202 });
}
