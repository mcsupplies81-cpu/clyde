import { NextRequest, NextResponse } from "next/server";
import { and, eq, lte } from "drizzle-orm";
import { db } from "@/db";
import { chaseFollowUps, loads, inboxes, auditLogs } from "@/db/schema";
import { sendReply } from "@/lib/email-sender";

export async function GET(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Find all active follow-ups due to fire
  const due = await db.select().from(chaseFollowUps).where(
    and(eq(chaseFollowUps.status, "active"), lte(chaseFollowUps.nextSendAt, now)),
  );

  const results: Array<Record<string, unknown>> = [];

  for (const fu of due) {
    try {
      const load = await db.query.loads.findFirst({
        where: eq(loads.id, fu.loadId),
        columns: { loadNumber: true },
      });
      const inbox = await db.query.inboxes.findFirst({
        where: eq(inboxes.tenantId, fu.tenantId),
        columns: { emailAddress: true, name: true },
      });

      const fromEmail = inbox?.emailAddress ?? "ops@inbox.clydefreight.com";
      const fromName  = inbox?.name ? `Clyde | ${inbox.name}` : "Clyde Freight Ops";
      const isMulti   = fu.docTypes.includes(",");
      const subject   = isMulti
        ? `[Follow-up ${fu.sendCount + 1}] Missing Documents — Load #${load?.loadNumber ?? fu.loadId}`
        : `[Follow-up ${fu.sendCount + 1}] ${fu.docTypes} Request — Load #${load?.loadNumber ?? fu.loadId}`;

      const followUpNote = `\n\n---\nThis is follow-up #${fu.sendCount + 1} of ${fu.maxSends}. If you have already sent these documents, please disregard this message.`;
      const body = fu.messageTemplate + followUpNote;

      const result = await sendReply({ to: fu.carrierEmail, from: fromEmail, fromName, subject, body });

      const newSendCount = fu.sendCount + 1;
      const completed    = newSendCount >= fu.maxSends;
      const nextSendAt   = new Date(now.getTime() + fu.intervalDays * 24 * 60 * 60 * 1000);

      await db.update(chaseFollowUps).set({
        sendCount: newSendCount,
        status: completed ? "completed" : "active",
        nextSendAt,
      }).where(eq(chaseFollowUps.id, fu.id));

      await db.insert(auditLogs).values({
        tenantId: fu.tenantId,
        actorType: "system",
        actorName: "Clyde Autopilot",
        entityType: "load",
        entityId: fu.loadId,
        action: "chase_followup_sent",
        metadata: { followUpId: fu.id, docTypes: fu.docTypes, sendCount: newSendCount, mode: result.mode, completed },
      });

      results.push({ id: fu.id, docTypes: fu.docTypes, sent: result.sent, mode: result.mode, sendCount: newSendCount, completed });
    } catch (err) {
      results.push({ id: fu.id, error: (err as Error).message });
    }
  }

  return NextResponse.json({ processed: due.length, results });
}
