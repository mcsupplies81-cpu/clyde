import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { auditLogs } from '@/db/schema';

export async function POST(req: Request) {
  const body = await req.json();
  const [row] = await db.insert(auditLogs).values({
    actor: body.actor,
    action: body.action,
    entityType: body.entityType,
    entityId: body.entityId,
    payload: JSON.stringify(body.payload ?? {}),
  }).returning();
  return NextResponse.json({ ok: true, id: row.id });
}
