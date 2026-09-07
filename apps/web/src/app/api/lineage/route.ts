import { type NextRequest, NextResponse } from 'next/server';
import { addRevenueLineageEdge, getRevenueLineage, recordBusinessOutcome } from '@/lib/revenue-lineage-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get('entityType'); const id = request.nextUrl.searchParams.get('entityId');
  if (!type || !id) return NextResponse.json({ error: 'entityType and entityId are required' }, { status: 400 });
  try { return NextResponse.json(await getRevenueLineage(type, id), { headers: { 'cache-control': 'no-store' } }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Lineage unavailable' }, { status: 503 }); }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    if (body.action === 'outcome') return NextResponse.json(await recordBusinessOutcome({ entityType: String(body.entityType), entityId: String(body.entityId), outcomeType: String(body.outcomeType), status: body.status ? String(body.status) : undefined, amount: body.amount == null ? null : Number(body.amount), currency: body.currency ? String(body.currency) : undefined, metadata: body.metadata }));
    return NextResponse.json(await addRevenueLineageEdge({ fromType: String(body.fromType), fromId: String(body.fromId), relation: String(body.relation), toType: String(body.toType), toId: String(body.toId), why: body.why, confidence: body.confidence == null ? undefined : Number(body.confidence), metadata: body.metadata }));
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Lineage write failed' }, { status: 400 }); }
}
