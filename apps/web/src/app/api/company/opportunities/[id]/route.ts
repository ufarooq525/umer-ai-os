import { NextResponse } from 'next/server';
import { loadOpportunityDetail } from '@/lib/opportunity-detail';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const model = await loadOpportunityDetail(id, { includeNeighbors: false });
  if (!model) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(model);
}
