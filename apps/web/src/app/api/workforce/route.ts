import { NextResponse } from 'next/server';
import { getWorkforceSnapshot } from '@/lib/workforce-api';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await getWorkforceSnapshot(), {
      headers: { 'cache-control': 'no-store' },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    );
  }
}
