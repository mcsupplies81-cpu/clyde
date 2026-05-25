import { NextResponse } from 'next/server';
import { ai } from '@/lib/openai';

export async function POST(req: Request) {
  const { inboundEmail, context } = await req.json();
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ draft: 'OPENAI_API_KEY missing' }, { status: 400 });
  const resp = await ai.responses.create({
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    input: `You are Clyde, draft a concise freight broker reply.\nEmail: ${inboundEmail}\nContext:${JSON.stringify(context)}`,
  });
  const draft = resp.output_text || 'No draft generated';
  return NextResponse.json({ draft });
}
