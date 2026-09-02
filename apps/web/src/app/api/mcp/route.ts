import { NextRequest, NextResponse } from 'next/server';
import { authorizeMcpToolCall, getMcpControlState } from '@/lib/mcp-control-api';

export const dynamic = 'force-dynamic';

export async function GET() {
  try { return NextResponse.json(await getMcpControlState(), { headers: { 'cache-control': 'no-store' } }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'MCP state unavailable' }, { status: 503 }); }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { toolId?: string; agentId?: string; taskId?: string; input?: unknown; estimatedCost?: number };
    if (!body.toolId || !body.agentId) return NextResponse.json({ error: 'toolId and agentId are required' }, { status: 400 });
    const result = await authorizeMcpToolCall({ toolId: body.toolId, agentId: body.agentId, taskId: body.taskId, input: body.input, estimatedCost: body.estimatedCost });
    return NextResponse.json(result, { status: result.allowed ? 200 : 403, headers: { 'cache-control': 'no-store' } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'MCP authorization failed' }, { status: 400 }); }
}
