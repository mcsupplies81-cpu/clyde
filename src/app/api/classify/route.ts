import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { subject, body } = await req.json();
  const text = `${subject} ${body}`.toLowerCase();
  const classification = text.includes('eta') || text.includes('delayed') ? 'status_update' : 'general';
  return NextResponse.json({ classification });
}
