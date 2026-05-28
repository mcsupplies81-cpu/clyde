"use server";

import { revalidatePath } from "next/cache";
import { and, eq, desc, lte } from "drizzle-orm";
import { db } from "@/db";
import { loads, inboxes, emailMessages, emailThreads, auditLogs, chaseFollowUps } from "@/db/schema";
import { getTenantIdForUser } from "@/lib/auth";
import { sendEmail } from "@/lib/send-email";

export type ChaseResult = { ok: true; mode: string; followUpId?: string } | { ok: false; error: string };

async function doChaseEmail(params: {
  tenantId: string;
  loadId: string;
  docTypes: string;   // comma-separated or single
  carrierEmail: string;
  message: string;
  loadNumber: string;
  fromEmail: string;
  fromName: string;
}): Promise<{ sent: boolean; mode?: string; error?: string }> {
  const isMulti = params.docTypes.includes(",");
  const subject = isMulti
    ? `Missing Documents: Load #${params.loadNumber}`
    : `${params.docTypes} Request: Load #${params.loadNumber}`;
  return sendEmail(params.tenantId, { to: params.carrierEmail, from: params.fromEmail, fromName: params.fromName, subject, body: params.message });
}

export async function chaseDocumentAction(_prev: ChaseResult | null, formData: FormData): Promise<ChaseResult> {
  const tenantId = await getTenantIdForUser();
  if (!tenantId) return { ok: false, error: "Not authenticated" };

  const loadId       = String(formData.get("loadId") ?? "").trim();
  const docType      = String(formData.get("docType") ?? "").trim();
  const carrierEmail = String(formData.get("carrierEmail") ?? "").trim();
  const message      = String(formData.get("message") ?? "").trim();
  const withFollowUp = formData.get("withFollowUp") === "true";

  if (!loadId || !carrierEmail || !message) return { ok: false, error: "Missing required fields" };

  const load = await db.query.loads.findFirst({
    where: and(eq(loads.id, loadId), eq(loads.tenantId, tenantId)),
    columns: { id: true, loadNumber: true, carrierName: true },
  });
  if (!load) return { ok: false, error: "Load not found" };

  const inbox = await db.query.inboxes.findFirst({
    where: eq(inboxes.tenantId, tenantId),
    orderBy: [desc(inboxes.createdAt)],
    columns: { emailAddress: true, name: true },
  });
  const fromEmail = inbox?.emailAddress ?? `ops@inbox.clydefreight.com`;
  const fromName  = inbox?.name ? `Clyde | ${inbox.name}` : "Clyde Freight Ops";

  const result = await doChaseEmail({ tenantId, loadId, docTypes: docType, carrierEmail, message, loadNumber: load.loadNumber, fromEmail, fromName });
  if (!result.sent) return { ok: false, error: result.error ?? "Send failed" };

  await db.insert(auditLogs).values({
    tenantId, actorType: "user", actorName: "Clyde",
    entityType: "load", entityId: loadId,
    action: "document_chased",
    metadata: { docType, carrierEmail, mode: result.mode, withFollowUp },
  });

  let followUpId: string | undefined;
  if (withFollowUp) {
    const nextSendAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 2 days
    const [fu] = await db.insert(chaseFollowUps).values({
      tenantId, loadId, docTypes: docType, carrierEmail,
      messageTemplate: message, sendCount: 1, maxSends: 3, intervalDays: 2, nextSendAt,
    }).returning({ id: chaseFollowUps.id });
    followUpId = fu.id;
  }

  revalidatePath(`/app/loads/${loadId}`);
  return { ok: true, mode: result.mode!, followUpId };
}

export async function chaseAllDocumentsAction(_prev: ChaseResult | null, formData: FormData): Promise<ChaseResult> {
  const tenantId = await getTenantIdForUser();
  if (!tenantId) return { ok: false, error: "Not authenticated" };

  const loadId       = String(formData.get("loadId") ?? "").trim();
  const docTypesRaw  = String(formData.get("docTypes") ?? "").trim();
  const carrierEmail = String(formData.get("carrierEmail") ?? "").trim();
  const message      = String(formData.get("message") ?? "").trim();
  const withFollowUp = formData.get("withFollowUp") === "true";
  const docTypes     = docTypesRaw.split(",").map((d) => d.trim()).filter(Boolean);

  if (!loadId || !carrierEmail || !message || !docTypes.length) return { ok: false, error: "Missing required fields" };

  const load = await db.query.loads.findFirst({
    where: and(eq(loads.id, loadId), eq(loads.tenantId, tenantId)),
    columns: { id: true, loadNumber: true, carrierName: true },
  });
  if (!load) return { ok: false, error: "Load not found" };

  const inbox = await db.query.inboxes.findFirst({
    where: eq(inboxes.tenantId, tenantId),
    orderBy: [desc(inboxes.createdAt)],
    columns: { emailAddress: true, name: true },
  });
  const fromEmail = inbox?.emailAddress ?? `ops@inbox.clydefreight.com`;
  const fromName  = inbox?.name ? `Clyde | ${inbox.name}` : "Clyde Freight Ops";

  const result = await doChaseEmail({ tenantId, loadId, docTypes: docTypesRaw, carrierEmail, message, loadNumber: load.loadNumber, fromEmail, fromName });
  if (!result.sent) return { ok: false, error: result.error ?? "Send failed" };

  await db.insert(auditLogs).values({
    tenantId, actorType: "user", actorName: "Clyde",
    entityType: "load", entityId: loadId,
    action: "documents_chased",
    metadata: { docTypes, carrierEmail, mode: result.mode, withFollowUp },
  });

  let followUpId: string | undefined;
  if (withFollowUp) {
    const nextSendAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const [fu] = await db.insert(chaseFollowUps).values({
      tenantId, loadId, docTypes: docTypesRaw, carrierEmail,
      messageTemplate: message, sendCount: 1, maxSends: 3, intervalDays: 2, nextSendAt,
    }).returning({ id: chaseFollowUps.id });
    followUpId = fu.id;
  }

  revalidatePath(`/app/loads/${loadId}`);
  return { ok: true, mode: result.mode!, followUpId };
}

export async function cancelChaseFollowUpAction(followUpId: string, loadId?: string): Promise<void> {
  const tenantId = await getTenantIdForUser();
  if (!tenantId) return;
  await db.update(chaseFollowUps)
    .set({ status: "cancelled" })
    .where(and(eq(chaseFollowUps.id, followUpId), eq(chaseFollowUps.tenantId, tenantId)));
  if (loadId) revalidatePath(`/app/loads/${loadId}`);
  revalidatePath("/app/loads");
}
