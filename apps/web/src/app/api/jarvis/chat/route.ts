import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type JarvisChatRequest = { sessionId?: string; message?: string };

export async function POST(request: Request) {
  const body = (await request.json()) as JarvisChatRequest;
  const message = body.message?.trim();
  if (!message) return NextResponse.json({ error: 'Say something first.' }, { status: 400 });

  const base = (process.env.JARVIS_API_URL ?? 'http://127.0.0.1:3010').replace(/\/+$/, '');

  try {
    const response = await fetch(`${base}/v1/jarvis/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId: body.sessionId, message }),
    });
    const payload = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      const detail = typeof payload.message === 'string' ? payload.message : undefined;
      const code = typeof payload.error === 'string' ? payload.error : undefined;
      return NextResponse.json(
        { error: detail ?? code ?? `JARVIS did not answer (${response.status}).` },
        { status: response.status },
      );
    }
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json(
      { error: 'Cannot reach JARVIS. Is apps/jarvis-api running?' },
      { status: 503 },
    );
  }
}
