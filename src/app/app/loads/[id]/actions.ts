"use server";

import { revalidatePath } from "next/cache";
import { and, eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { loads, inboxes, emailMessages, emailThreads, auditLogs } from "@/db/schema";
import { getTenantIdForUser } from "@/lib/auth";
import { sendReply } from "@/lib/email-sender";

export type ChaseResult = { ok: true; mode: string } | { ok: false; error: string };

export async function chaseDocumentAction(_prev: ChaseResult | null, formData: FormData): Promise<ChaseResult> {
  const tenantId = await getTenantIdForUser();
  if (!tenantId) return { ok: false, error: "Not authenticated" };

  const loadId      = String(formData.get("loadId") ?? "").trim();
  const docType     = String(formData.get("docType") ?? "").trim();
  const carrierEmail = String(formData.get("carrierEmail") ?? "").trim();
  const message     = String(formData.get("message") ?? "").trim();

  if (!loadId || !carrierEmail || !message) return { ok: false, error: "Missing required fields" };

  // Verify load belongs to this tenant
  const load = await db.query.loads.findFirst({
    where: and(eq(loads.id, loadId), eq(loads.tenantId, tenantId)),
    columns: { id: true, loadNumber: true, carrierName: true },
  });
  if (!load) return { ok: false, error: "Load not found" };

  // Get "from" address — the tenant's inbox email
  const inbox = await db.query.inboxes.findFirst({
    where: eq(inboxes.tenantId, tenantId),
    orderBy: [desc(inboxes.createdAt)],
    columns: { emailAddress: true, name: true },
  });

  const fromEmail = inbox?.emailAddress ?? `ops@inbox.clydefreight.com`;
  const fromName  = inbox?.name ? `Clyde | ${inbox.name}` : "Clyde Freight Ops";
  const subject   = `${docType} Request — Load #${load.loadNumber}`;

  const result = await sendReply({
    to: carrierEmail,
    from: fromEmail,
    fromName,
    subject,
    body: message,
  });

  if (!result.sent) return { ok: false, error: result.error ?? "Send failed" };

  // Audit log
  await db.insert(auditLogs).values({
    tenantId,
    actorType: "user",
    actorName: "Clyde",
    entityType: "load",
    entityId: loadId,
    action: "document_chased",
    metadata: { docType, carrierEmail, mode: result.mode },
  });

  revalidatePath(`/app/loads/${loadId}`);
  return { ok: true, mode: result.mode };
}
