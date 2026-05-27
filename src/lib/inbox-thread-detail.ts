import { db } from "@/db";
import { emailMessages, aiClassifications, aiDrafts, sopRules, loadDocuments, auditLogs, emailAttachments } from "@/db/schema";
import { eq, desc, and, inArray } from "drizzle-orm";
import { matchLoad } from "@/lib/load-matcher";
import { generateResolutionPlan } from "@/lib/resolution";

export async function fetchThreadDetail(tenantId: string, threadId: string) {
  const messages = await db.query.emailMessages.findMany({
    where: eq(emailMessages.threadId, threadId),
    orderBy: [desc(emailMessages.receivedAt)],
  });

  const allMsgIds = messages.map((m) => m.id);
  const firstInbound = messages.find((m) => m.direction === "inbound");

  const [threadClassificationsRaw, draft] = await Promise.all([
    allMsgIds.length
      ? db.select().from(aiClassifications).where(inArray(aiClassifications.messageId, allMsgIds)).orderBy(desc(aiClassifications.createdAt))
      : Promise.resolve([] as typeof aiClassifications.$inferSelect[]),
    firstInbound
      ? db.query.aiDrafts.findFirst({ where: eq(aiDrafts.messageId, firstInbound.id), orderBy: [desc(aiDrafts.createdAt)] })
      : Promise.resolve(null),
  ]);

  const classification = threadClassificationsRaw[0] ?? null;

  const [loadMatch, appliedSops] = await Promise.all([
    classification ? matchLoad(classification, tenantId, db) : Promise.resolve(null),
    classification?.category
      ? db.select().from(sopRules).where(and(eq(sopRules.tenantId, tenantId), eq(sopRules.isActive, true), eq(sopRules.category, classification.category)))
      : Promise.resolve([] as typeof sopRules.$inferSelect[]),
  ]);

  const matchedLoad = loadMatch?.load ?? null;

  const draftIds = draft ? [draft.id] : [];
  const classificationIds = threadClassificationsRaw.map((c) => c.id);
  const timelineEntityIds = [threadId, ...allMsgIds, ...draftIds, ...classificationIds];

  const [loadDocs, msgAttachments, auditEntries] = await Promise.all([
    matchedLoad
      ? db.select().from(loadDocuments).where(eq(loadDocuments.loadId, matchedLoad.id))
      : Promise.resolve([] as typeof loadDocuments.$inferSelect[]),
    allMsgIds.length
      ? db.select().from(emailAttachments).where(inArray(emailAttachments.messageId, allMsgIds))
      : Promise.resolve([] as typeof emailAttachments.$inferSelect[]),
    timelineEntityIds.length
      ? db.select().from(auditLogs)
          .where(and(eq(auditLogs.tenantId, tenantId), inArray(auditLogs.entityId, timelineEntityIds)))
          .orderBy(desc(auditLogs.createdAt)).limit(30)
      : Promise.resolve([] as typeof auditLogs.$inferSelect[]),
  ]);

  const messageEvents = messages
    .filter((m) => m.direction === "inbound")
    .map((m) => ({
      id: `msg_${m.id}`, action: "email_received", actorType: "system" as const,
      actorName: m.senderName ?? m.senderEmail, entityType: "email_message",
      entityId: m.id, createdAt: m.receivedAt ?? m.createdAt,
      metadata: null as null | Record<string, unknown>,
    }));

  const auditEvents = auditEntries.map((e) => ({
    id: e.id, action: e.action, actorType: e.actorType, actorName: e.actorName,
    entityType: e.entityType, entityId: e.entityId, createdAt: e.createdAt,
    metadata: e.metadata ?? null,
  }));

  const timeline = [...messageEvents, ...auditEvents].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const resolutionPlan = classification
    ? generateResolutionPlan({ category: classification.category, classification, matchedLoad, appliedSops })
    : null;

  // Index attachments by messageId for easy lookup in the UI
  const attachmentsByMessage: Record<string, typeof emailAttachments.$inferSelect[]> = {};
  for (const a of msgAttachments) {
    if (!attachmentsByMessage[a.messageId]) attachmentsByMessage[a.messageId] = [];
    attachmentsByMessage[a.messageId].push(a);
  }

  return {
    messages,
    classification,
    matchedLoad,
    draft: draft ?? null,
    timeline,
    appliedSops,
    loadDocs,
    attachmentsByMessage,
    resolutionPlan,
  };
}

export type ThreadDetail = Awaited<ReturnType<typeof fetchThreadDetail>>;
