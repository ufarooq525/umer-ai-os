import { NextRequest, NextResponse } from 'next/server';
import { executeCEOControl, getControlState } from '@/lib/ceo-control-api';

export const dynamic = 'force-dynamic';

export async function GET() {
  try { return NextResponse.json(await getControlState(), { headers: { 'cache-control': 'no-store' } }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Control state unavailable' }, { status: 503 }); }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { action?: string; targetId?: string; agentId?: string; reason?: string };
    const allowed = ['pause_agent', 'resume_agent', 'retry_task', 'reassign_task', 'cancel_task'];
    if (!body.action || !allowed.includes(body.action)) return NextResponse.json({ error: 'Invalid control action' }, { status: 400 });
    if (!body.targetId) return NextResponse.json({ error: 'targetId is required' }, { status: 400 });
    const result = await executeCEOControl({ action: body.action as never, targetId: body.targetId, agentId: body.agentId, reason: body.reason });
    return NextResponse.json({ ok: true, result }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Control action failed' }, { status: 400 }); }
}
