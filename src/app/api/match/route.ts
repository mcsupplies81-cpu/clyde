import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { loads } from '@/db/schema';

export async function POST(req: Request) {
  const { text } = await req.json();
  const allLoads = await db.select().from(loads);
  const found = allLoads.find((l) => text.includes(l.loadNumber));
  return NextResponse.json({ loadId: found?.id ?? null, confidence: found ? 0.93 : 0 });
}
