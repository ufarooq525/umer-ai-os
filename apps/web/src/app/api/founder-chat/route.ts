import { NextResponse } from 'next/server';
import { UMER_FOUNDER_EMAIL, UMER_SITE_URL } from '@/lib/founder-identity';

export const dynamic = 'force-dynamic';

const SYSTEM = `You are Umer Farooq's thinking partner inside Umer AI OS, his company operating system.
He will dump raw thoughts — voice transcripts, half-formed ideas, worries, opportunities.
Answer in plain English. Be short. Do not invent invoices, traffic, rankings, or conversion percentages.
If something is unknown, say so. He sells software that rebuilds systems businesses are afraid to touch.
His public email is ${UMER_FOUNDER_EMAIL}. Site: ${UMER_SITE_URL}.
You may suggest a next action inside the OS (Decisions, Opportunities, Gates, SEO) when it is real.`;

type ChatTurn = { role: 'user' | 'assistant'; content: string };

export async function POST(request: Request) {
  const body = (await request.json()) as { messages?: ChatTurn[] };
  const messages = (body.messages ?? []).filter((m) => m.content?.trim()).slice(-12);
  if (messages.length === 0) return NextResponse.json({ error: 'Say something first.' }, { status: 400 });

  const base = (process.env.LLM_BASE_URL ?? 'http://localhost:1234/v1').replace(/\/+$/, '');
  const model = process.env.LLM_MODEL?.trim() || 'qwen/qwen3-8b';

  try {
    const response = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        max_tokens: 700,
        messages: [{ role: 'system', content: SYSTEM }, ...messages],
      }),
    });
    if (!response.ok) {
      return NextResponse.json(
        { error: `Local model did not answer (${response.status}). Is LM Studio running?` },
        { status: 502 },
      );
    }
    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const reply = payload.choices?.[0]?.message?.content?.trim();
    if (!reply) return NextResponse.json({ error: 'The model returned an empty answer.' }, { status: 502 });
    return NextResponse.json({ reply });
  } catch {
    return NextResponse.json({ error: 'Cannot reach the local model at localhost:1234. Start LM Studio.' }, { status: 503 });
  }
}
