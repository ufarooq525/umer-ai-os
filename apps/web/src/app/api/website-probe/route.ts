import { NextResponse } from 'next/server';
import { probeWebsite } from '@/lib/website-probe';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get('url')?.trim();
  if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 });
  const probe = await probeWebsite(url);
  return NextResponse.json(probe);
}
