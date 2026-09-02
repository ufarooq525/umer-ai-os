import { NextResponse } from 'next/server';
import { recordWorkerHeartbeat, superviseWorkers } from '@/lib/ai-worker-supervisor';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    return NextResponse.json(await superviseWorkers(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[supervisor] GET failed', error);
    return NextResponse.json({ error: 'Worker supervisor unavailable' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body?.agentId || !body?.workerId) return NextResponse.json({ error: 'agentId and workerId are required' }, { status: 400 });
    return NextResponse.json(await recordWorkerHeartbeat({
      agentId: String(body.agentId),
      workerId: String(body.workerId),
      status: body.status ? String(body.status) : undefined,
      lastTaskId: body.lastTaskId ? String(body.lastTaskId) : null,
      metadata: body.metadata,
    }));
  } catch (error) {
    console.error('[supervisor] POST failed', error);
    return NextResponse.json({ error: 'Unable to record worker heartbeat' }, { status: 503 });
  }
}
