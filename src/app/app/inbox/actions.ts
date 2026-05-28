"use server";

import { db } from "@/db";
import {
  emailThreads, emailMessages, loads,
  aiClassifications, aiDrafts, auditLogs, sopRules,
  inboxConnections, inboxes, emailAttachments, loadDocuments,
} from "@/db/schema";
import { eq, desc, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { mockClassify, openAiClassify } from "@/lib/ai-classifier";
import { canAutoSend, requiresHumanApproval, SAFE_TO_AUTO_DRAFT, NEVER_AUTO_SEND } from "@/lib/safety";
import { getTenantIdForUser } from "@/lib/auth";
import { sendReply } from "@/lib/email-sender";
import { sendViaGmail, hasGmailConnection } from "@/lib/gmail";

async function getTenantId(): Promise<string> {
  const id = await getTenantIdForUser();
  return id ?? "";
}

export async function classifyMessageAction(formData: FormData) {
  const tenantId = await getTenantId();
  const input = {
    messageId: String(formData.get("messageId") ?? ""),
    subject:   String(formData.get("subject") ?? ""),
    body:      String(formData.get("body") ?? ""),
    senderName:  String(formData.get("senderName") ?? ""),
    senderEmail: String(formData.get("senderEmail") ?? ""),
  };
  const tid = formData.get("threadId") ? String(formData.get("threadId")) : undefined;

  const result = process.env.OPENAI_API_KEY ? await openAiClassify(input) : mockClassify(input);

  await db.delete(aiClassifications).where(eq(aiClassifications.messageId, input.messageId));
  const [inserted] = await db.insert(aiClassifications).values({
    tenantId,
    messageId: input.messageId,
    category: result.category,
    urgency: result.urgency,
    confidence: String(result.confidence),
    extractedLoadNumber: result.extractedLoadNumber,
    extractedPoNumber: result.extractedPoNumber,
    extractedCustomer: result.extractedCustomer,
    extractedCarrier: result.extractedCarrier,
    extractedLane: result.extractedLane,
    suggestedAction: result.suggestedAction,
    reasoning: result.reasoning,
    extractedEntities: result.extractedEntities,
  }).returning({ id: aiClassifications.id });

  await db.insert(auditLogs).values({
    tenantId, actorType: "ai", actorName: "Clyde AI",
    entityType: "ai_classification", entityId: inserted?.id ?? input.messageId,
    action: "classification_created",
    metadata: { messageId: input.messageId, category: result.category, confidence: result.confidence, threadId: tid },
  });
  if (tid) {
    await db.insert(auditLogs).values({
      tenantId, actorType: "ai", actorName: "Clyde AI",
      entityType: "email_thread", entityId: tid,
      action: "thread_classified",
      metadata: { category: result.category, urgency: result.urgency },
    });
  }
  revalidatePath("/app/inbox");
}

export async function generateDraftAction(formData: FormData) {
  const tenantId = await getTenantId();
  const messageId      = String(formData.get("messageId") ?? "");
  const classificationId = formData.get("classificationId") ? String(formData.get("classificationId")) : undefined;
  const loadId         = formData.get("loadId") ? String(formData.get("loadId")) : undefined;
  const tid            = formData.get("threadId") ? String(formData.get("threadId")) : undefined;

  const [message] = await db.select().from(emailMessages).where(eq(emailMessages.id, messageId)).limit(1);
  if (!message) return;

  const [cls] = classificationId
    ? await db.select().from(aiClassifications).where(eq(aiClassifications.id, classificationId)).limit(1)
    : [];
  const [load] = loadId
    ? await db.select().from(loads).where(eq(loads.id, loadId)).limit(1)
    : [];

  // Fetch SOPs and thread history in parallel
  const [sops, threadHistory] = await Promise.all([
    cls?.category
      ? db.select().from(sopRules).where(
          and(eq(sopRules.tenantId, tenantId), eq(sopRules.isActive, true), eq(sopRules.category, cls.category)),
        )
      : Promise.resolve([]),
    tid
      ? db.select({
          direction: emailMessages.direction,
          senderName: emailMessages.senderName,
          body: emailMessages.body,
          receivedAt: emailMessages.receivedAt,
        })
          .from(emailMessages)
          .where(and(eq(emailMessages.threadId, tid), eq(emailMessages.tenantId, tenantId)))
          .limit(6)
      : Promise.resolve([]),
  ]);

  const makeFallbackDraft = () => {
    const ref = load?.loadNumber ? `load #${load.loadNumber}` : "your shipment";
    const cat = cls?.category ?? "general";
    if (cat === "quote_request") return `Thank you for your quote request. We are reviewing the lane details (${message.subject}) and will follow up with pricing shortly.`;
    if (cat === "detention_accessorial") return `Thank you for your message regarding ${ref}. We are reviewing the detention/accessorial details and will respond with next steps shortly.`;
    if (cat === "pod_request") return `Thank you for your message regarding ${ref}. We are working to retrieve the POD and will send it over shortly.`;
    if (cat === "bol_request") return `Thank you for reaching out about ${ref}. We will pull the BOL and forward it to you as soon as possible.`;
    if (cat === "status_request") return `Thank you for checking in on ${ref}. We are actively monitoring this shipment and will provide a status update shortly.`;
    return `Thank you for reaching out regarding ${ref}. Our team is reviewing this and will follow up shortly with the information you requested.`;
  };

  // Build category-specific guidance for the AI
  const CATEGORY_GUIDANCE: Record<string, string> = {
    status_request: "The customer is asking for a status update. Provide the current load status, location if known, and ETA. Be specific with the load number and any relevant timing details.",
    pod_request: "The customer or carrier is requesting the Proof of Delivery (POD). Acknowledge the request, confirm the load number, and let them know when to expect it or that you are retrieving it.",
    bol_request: "The customer or carrier needs the Bill of Lading (BOL). Acknowledge the request and confirm you will send it over or are retrieving it.",
    carrier_update: "A carrier is providing or requesting an update. Acknowledge their communication and respond accordingly to keep the shipment moving.",
    quote_request: "The customer is requesting a freight quote. Acknowledge the lane details, confirm you received their request, and let them know you will follow up with pricing.",
    appointment_change: "There is an appointment change request or notification. Acknowledge the change, confirm the load number, and clarify next steps.",
    detention_accessorial: "This involves detention or an accessorial charge. Be professional, acknowledge the claim, and let them know it is under review. Do not commit to payment.",
    escalation: "This is an escalated or urgent issue. Respond with urgency, acknowledge the problem, and commit to immediate follow-up.",
  };

  let draftBody: string;
  if (process.env.OPENAI_API_KEY) {
    try {
      const OpenAI = (await import("openai")).default;
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 15000 });

      const fmt = (d: Date | null | undefined) => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;

      const loadContext = load ? [
        `Load #${load.loadNumber}`,
        `Route: ${load.originCity}, ${load.originState} → ${load.destinationCity}, ${load.destinationState}`,
        `Status: ${load.currentStatus ?? "Unknown"}`,
        load.carrierName ? `Carrier: ${load.carrierName}` : null,
        load.driverName ? `Driver: ${load.driverName}${load.driverPhone ? ` (${load.driverPhone})` : ""}` : null,
        load.customerName ? `Customer: ${load.customerName}` : null,
        load.pickupAt ? `Pickup: ${fmt(load.pickupAt)}` : null,
        load.deliveryAt ? `Delivery: ${fmt(load.deliveryAt)}` : null,
        load.eta ? `ETA: ${fmt(load.eta)}` : null,
        load.equipmentType ? `Equipment: ${load.equipmentType}` : null,
        load.riskLevel && load.riskLevel !== "low" ? `Risk: ${load.riskLevel}` : null,
        load.internalNotes ? `Notes: ${load.internalNotes}` : null,
      ].filter(Boolean).join("\n") : null;

      const historyContext = threadHistory.length > 1
        ? `\nConversation history (oldest first):\n${threadHistory
            .slice(0, -1) // exclude current message (already in main body)
            .map((m) => `[${m.direction === "inbound" ? "THEM" : "US"}] ${m.body.slice(0, 200)}`)
            .join("\n---\n")}`
        : null;

      const context = [
        `Email subject: ${message.subject ?? "(none)"}`,
        `Email body:\n${message.body}`,
        loadContext ? `\nLoad details:\n${loadContext}` : "",
        historyContext ?? "",
        sops.length ? `\nSOPs / instructions to follow:\n${sops.map((s) => `- ${s.ruleText}`).join("\n")}` : "",
      ].filter(Boolean).join("\n");

      const categoryNote = cls?.category ? (CATEGORY_GUIDANCE[cls.category] ?? "") : "";

      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 300,
        messages: [
          {
            role: "system",
            content: [
              "You are Clyde, a freight ops AI assistant for a freight brokerage.",
              "Draft a concise, professional email reply that the broker can send to the customer or carrier.",
              categoryNote,
              "Rules:",
              "- Never invent load details not explicitly provided.",
              "- Always reference the load number if available.",
              "- Keep it under 150 words.",
              "- Do not use subject lines or headers — body text only.",
              "- Sign off as 'Clyde\\nFreight Ops AI'.",
              "- Do not say the email has been sent or will be sent automatically.",
            ].filter(Boolean).join("\n"),
          },
          { role: "user", content: context },
        ],
      });
      draftBody = completion.choices[0]?.message?.content ?? makeFallbackDraft();
    } catch (err) {
      console.error("[generateDraft] OpenAI failed, using fallback:", err);
      draftBody = makeFallbackDraft();
    }
  } else {
    draftBody = makeFallbackDraft();
  }

  const [insertedDraft] = await db.insert(aiDrafts).values({
    tenantId, messageId: message.id, loadId: load?.id ?? null,
    draftSubject: `Re: ${message.subject ?? "Your inquiry"}`,
    draftBody, confidence: "0.85", approvalRequired: true, status: "pending",
  }).returning({ id: aiDrafts.id });

  await db.insert(auditLogs).values({
    tenantId, actorType: "ai", actorName: "Clyde AI",
    entityType: "ai_draft", entityId: insertedDraft?.id ?? messageId,
    action: "draft_generated",
    metadata: { messageId, loadId: load?.id, category: cls?.category, threadId: tid },
  });
  if (tid) {
    await db.update(emailThreads).set({ status: "pending_review" }).where(
      and(eq(emailThreads.id, tid), eq(emailThreads.tenantId, tenantId)),
    );
  }
  revalidatePath("/app/inbox");
}

export async function approveDraftAction(formData: FormData) {
  const tenantId = await getTenantId();
  const draftId  = String(formData.get("draftId") ?? "");
  const threadId = formData.get("threadId") ? String(formData.get("threadId")) : undefined;
  if (!draftId) return;

  await db.update(aiDrafts).set({ status: "approved", approvedBy: "Marcus Webb", approvedAt: new Date(), updatedAt: new Date() }).where(eq(aiDrafts.id, draftId));
  await db.insert(auditLogs).values({
    tenantId, actorType: "user", actorName: "Marcus Webb",
    entityType: "ai_draft", entityId: draftId,
    action: "draft_approved", metadata: { draftId, threadId },
  });
  if (threadId) {
    await db.update(emailThreads).set({ status: "drafted" }).where(
      and(eq(emailThreads.id, threadId), eq(emailThreads.tenantId, tenantId)),
    );
    await db.insert(auditLogs).values({
      tenantId, actorType: "user", actorName: "Marcus Webb",
      entityType: "email_thread", entityId: threadId,
      action: "draft_approved", metadata: {},
    });
  }
  revalidatePath("/app/inbox");
}

export async function rejectDraftAction(formData: FormData) {
  const tenantId = await getTenantId();
  const draftId  = String(formData.get("draftId") ?? "");
  if (!draftId) return;

  await db.update(aiDrafts).set({ status: "rejected", updatedAt: new Date() }).where(eq(aiDrafts.id, draftId));
  await db.insert(auditLogs).values({
    tenantId, actorType: "user", actorName: "Marcus Webb",
    entityType: "ai_draft", entityId: draftId,
    action: "draft_rejected", metadata: { draftId },
  });
  revalidatePath("/app/inbox");
}

export async function editDraftAction(formData: FormData) {
  const tenantId = await getTenantId();
  const draftId  = String(formData.get("draftId") ?? "");
  const newBody  = String(formData.get("draftBody") ?? "");
  if (!draftId) return;

  await db.update(aiDrafts).set({ status: "edited", draftBody: newBody, updatedAt: new Date() }).where(eq(aiDrafts.id, draftId));
  await db.insert(auditLogs).values({
    tenantId, actorType: "user", actorName: "Marcus Webb",
    entityType: "ai_draft", entityId: draftId,
    action: "draft_edited", metadata: { draftId },
  });
  revalidatePath("/app/inbox");
}

export async function markSentManuallyAction(formData: FormData) {
  const tenantId = await getTenantId();
  const tid = String(formData.get("threadId") ?? "");
  if (!tid) return;

  // Also mark approved drafts as sent so the thread leaves "Ready to Send"
  const approvedDrafts = await db
    .select({ id: aiDrafts.id })
    .from(aiDrafts)
    .innerJoin(emailMessages, eq(aiDrafts.messageId, emailMessages.id))
    .where(and(eq(emailMessages.threadId, tid), inArray(aiDrafts.status, ["approved", "edited"])));
  if (approvedDrafts.length) {
    await db.update(aiDrafts)
      .set({ status: "sent", sentAt: new Date(), sentBy: "Marcus Webb (manual)", updatedAt: new Date() })
      .where(inArray(aiDrafts.id, approvedDrafts.map((d) => d.id)));
  }

  await db.update(emailThreads).set({ status: "sent" }).where(
    and(eq(emailThreads.id, tid), eq(emailThreads.tenantId, tenantId)),
  );
  await db.insert(auditLogs).values({
    tenantId, actorType: "user", actorName: "Marcus Webb",
    entityType: "email_thread", entityId: tid,
    action: "marked_sent_manually", metadata: {},
  });
  revalidatePath("/app/inbox");
}

// Send draft — actually sends via Postmark if POSTMARK_API_TOKEN is set,
// otherwise records the send in the DB and logs (safe dev fallback).
export async function demoSendDraftAction(_prevState: unknown, formData: FormData) {
  const tenantId = await getTenantId();
  const draftId = String(formData.get("draftId") ?? "");
  const tid = String(formData.get("threadId") ?? "");
  if (!draftId || !tid) return { error: "Missing params" };

  const [draft, thread] = await Promise.all([
    db.query.aiDrafts.findFirst({ where: eq(aiDrafts.id, draftId) }),
    db.query.emailThreads.findFirst({ where: eq(emailThreads.id, tid) }),
  ]);
  if (!draft) return { error: "Draft not found" };
  if (!thread) return { error: "Thread not found" };

  // Get inbox (from address) and original sender (to address)
  const [inbox, firstInbound] = await Promise.all([
    db.query.inboxes.findFirst({ where: eq(inboxes.id, thread.inboxId) }),
    db.query.emailMessages.findFirst({
      where: and(eq(emailMessages.threadId, tid), eq(emailMessages.direction, "inbound")),
      orderBy: [emailMessages.receivedAt],
    }),
  ]);

  const fromEmail = inbox?.emailAddress ?? "reply@clydefreight.com";
  const toEmail = firstInbound?.senderEmail ?? "";
  const body = draft.finalBody ?? draft.draftBody;
  const subject = draft.draftSubject ?? `Re: ${thread.subject}`;
  const now = new Date();

  // Actually send via Postmark (or dry-run if no token)
  if (toEmail) {
    const result = await sendReply({
      to: toEmail,
      from: fromEmail,
      fromName: "Clyde | Freight Ops",
      subject,
      body,
      inReplyToMessageId: firstInbound?.gmailMessageId,
    });
    if (!result.sent) {
      console.error("[sendDraft] Send failed:", result.error);
      // Don't block — still record in DB so broker knows it was attempted
    }
  }

  // Record outbound message
  await db.insert(emailMessages).values({
    tenantId,
    threadId: tid,
    direction: "outbound",
    senderName: "Clyde",
    senderEmail: fromEmail,
    recipientEmail: toEmail || "unknown",
    subject,
    body,
    receivedAt: now,
  });

  // Mark draft sent
  await db.update(aiDrafts)
    .set({ status: "sent", sentAt: now, sentBy: "Clyde", finalBody: body, updatedAt: now })
    .where(eq(aiDrafts.id, draftId));

  // Advance thread
  await db.update(emailThreads).set({ status: "sent" }).where(eq(emailThreads.id, tid));

  await db.insert(auditLogs).values({
    tenantId, actorType: "user", actorName: "Clyde",
    entityType: "email_thread", entityId: tid,
    action: "reply_sent", metadata: { draftId, to: toEmail, via: process.env.POSTMARK_API_TOKEN ? "postmark" : "dry-run" },
  });

  revalidatePath("/app/inbox");
  return { success: true };
}

export async function resolveThreadAction(formData: FormData) {
  const tenantId = await getTenantId();
  const tid = String(formData.get("threadId") ?? "");
  if (!tid) return;
  await db.update(emailThreads).set({ status: "resolved" }).where(
    and(eq(emailThreads.id, tid), eq(emailThreads.tenantId, tenantId)),
  );
  await db.insert(auditLogs).values({
    tenantId, actorType: "user", actorName: "Marcus Webb",
    entityType: "email_thread", entityId: tid,
    action: "thread_resolved", metadata: {},
  });
  revalidatePath("/app/inbox");
}

// ─── Save email attachment to load documents ───────────────────────────────────
// Lets brokers capture a BOL/POD that arrived via email into the load's doc list.

export async function saveAttachmentToLoadAction(
  _prevState: { success?: boolean; error?: string } | undefined,
  formData: FormData,
): Promise<{ success?: boolean; error?: string }> {
  const tenantId    = await getTenantId();
  const attachmentId = String(formData.get("attachmentId") ?? "");
  const loadId       = String(formData.get("loadId") ?? "");
  if (!attachmentId || !loadId) return { error: "Missing params" };

  const att = await db.query.emailAttachments.findFirst({
    where: eq(emailAttachments.id, attachmentId),
  });
  if (!att) return { error: "Attachment not found" };

  const load = await db.query.loads.findFirst({
    where: and(eq(loads.id, loadId), eq(loads.tenantId, tenantId)),
    columns: { id: true, loadNumber: true },
  });
  if (!load) return { error: "Load not found" };

  // Idempotent: skip if already saved by file name
  const existing = await db.query.loadDocuments.findFirst({
    where: and(eq(loadDocuments.loadId, loadId), eq(loadDocuments.fileName, att.fileName)),
  });
  if (existing) return { error: "Already saved to this load" };

  await db.insert(loadDocuments).values({
    tenantId,
    loadId,
    documentType: att.documentType ?? "Other",
    fileName: att.fileName,
    fileUrl: att.fileUrl ?? "",
  });

  await db.insert(auditLogs).values({
    tenantId, actorType: "user", actorName: "Marcus Webb",
    entityType: "load", entityId: loadId,
    action: "document_saved_from_email",
    metadata: { attachmentId, documentType: att.documentType, fileName: att.fileName, loadId },
  });

  revalidatePath(`/app/loads/${loadId}`);
  revalidatePath("/app/inbox");
  return { success: true };
}

// ─── Manual reply ─────────────────────────────────────────────────────────────
// Broker types their own reply (skips the AI draft entirely).

export async function sendManualReplyAction(
  _prevState: { success?: boolean; error?: string } | undefined,
  formData: FormData,
): Promise<{ success?: boolean; error?: string }> {
  const tenantId = await getTenantId();
  const threadId = String(formData.get("threadId") ?? "");
  const to       = String(formData.get("to") ?? "");
  const body     = String(formData.get("body") ?? "").trim();
  const subject  = String(formData.get("subject") ?? "");

  if (!threadId || !to || !body) return { error: "Missing required fields" };

  const thread = await db.query.emailThreads.findFirst({
    where: and(eq(emailThreads.id, threadId), eq(emailThreads.tenantId, tenantId)),
  });
  if (!thread) return { error: "Thread not found" };

  const inbox = await db.query.inboxes.findFirst({ where: eq(inboxes.id, thread.inboxId) });
  const fromEmail = inbox?.emailAddress ?? "reply@clydefreight.com";

  const firstInbound = await db.query.emailMessages.findFirst({
    where: and(eq(emailMessages.threadId, threadId), eq(emailMessages.direction, "inbound")),
    orderBy: [emailMessages.receivedAt],
  });

  // Use Gmail if connected, otherwise fall back to Postmark
  const gmailConnected = await hasGmailConnection(tenantId);
  const sendResult = gmailConnected
    ? await sendViaGmail(tenantId, {
        to,
        from: fromEmail,
        fromName: "Clyde | Freight Ops",
        subject,
        body,
        inReplyToMessageId: firstInbound?.gmailMessageId,
      })
    : await sendReply({
        to,
        from: fromEmail,
        fromName: "Clyde | Freight Ops",
        subject,
        body,
        inReplyToMessageId: firstInbound?.gmailMessageId,
      });

  console.log(`[sendManualReply] Sent via ${sendResult.mode}`, sendResult.sent ? "✓" : "✗ " + sendResult.error);
  if (!sendResult.sent) {
    console.warn("[sendManualReply] Send failed:", sendResult.error);
  }

  const now = new Date();

  await db.insert(emailMessages).values({
    tenantId,
    threadId,
    direction: "outbound",
    senderName: "Marcus Webb",
    senderEmail: fromEmail,
    recipientEmail: to,
    subject,
    body,
    receivedAt: now,
  });

  await db.update(emailThreads)
    .set({ status: "sent", lastMessageAt: now })
    .where(and(eq(emailThreads.id, threadId), eq(emailThreads.tenantId, tenantId)));

  await db.insert(auditLogs).values({
    tenantId, actorType: "user", actorName: "Marcus Webb",
    entityType: "email_thread", entityId: threadId,
    action: "manual_reply_sent",
    metadata: { to, subject, via: sendResult.sent ? "postmark" : "dry-run" },
  });

  revalidatePath("/app/inbox");
  return { success: true };
}

export async function escalateThreadAction(formData: FormData) {
  const tenantId = await getTenantId();
  const tid = String(formData.get("threadId") ?? "");
  if (!tid) return;
  await db.update(emailThreads).set({ status: "escalated", priority: "urgent" }).where(
    and(eq(emailThreads.id, tid), eq(emailThreads.tenantId, tenantId)),
  );
  await db.insert(auditLogs).values({
    tenantId, actorType: "user", actorName: "Marcus Webb",
    entityType: "email_thread", entityId: tid,
    action: "thread_escalated", metadata: {},
  });
  revalidatePath("/app/inbox");
}

// ─── Autopilot ────────────────────────────────────────────────────────────────
// Category routing is defined in @/lib/safety (NEVER_AUTO_SEND, SAFE_TO_AUTO_DRAFT, etc.)

export type AutopilotResult = {
  total: number;
  classified: number;
  drafted: number;
  autoSent: number;
  skipped: number;
  timestamp: string;
};

export async function runAutopilotAction(): Promise<AutopilotResult> {
  const tenantId = await getTenantId();
  const blank: AutopilotResult = { total: 0, classified: 0, drafted: 0, autoSent: 0, skipped: 0, timestamp: new Date().toISOString() };
  if (!tenantId) return blank;

  // Process open threads only (unprocessed)
  const openThreads = await db.query.emailThreads.findMany({
    where: and(eq(emailThreads.tenantId, tenantId), eq(emailThreads.status, "open")),
    limit: 50,
  });

  let classified = 0, drafted = 0, autoSent = 0, skipped = 0;

  for (const thread of openThreads) {
    // Get first inbound message
    const firstMsg = await db.query.emailMessages.findFirst({
      where: and(eq(emailMessages.threadId, thread.id), eq(emailMessages.direction, "inbound")),
    });
    if (!firstMsg) { skipped++; continue; }

    // Check existing classification
    let cls = await db.query.aiClassifications.findFirst({
      where: eq(aiClassifications.messageId, firstMsg.id),
      orderBy: [desc(aiClassifications.createdAt)],
    });

    // 1. Classify if needed
    if (!cls) {
      const input = {
        messageId: firstMsg.id,
        subject: firstMsg.subject ?? "",
        body: firstMsg.body,
        senderName: firstMsg.senderName ?? "",
        senderEmail: firstMsg.senderEmail,
      };
      const result = process.env.OPENAI_API_KEY ? await openAiClassify(input) : mockClassify(input);

      await db.delete(aiClassifications).where(eq(aiClassifications.messageId, firstMsg.id));
      const [inserted] = await db.insert(aiClassifications).values({
        tenantId, messageId: firstMsg.id,
        category: result.category, urgency: result.urgency,
        confidence: String(result.confidence),
        extractedLoadNumber: result.extractedLoadNumber,
        extractedPoNumber: result.extractedPoNumber,
        extractedCustomer: result.extractedCustomer,
        extractedCarrier: result.extractedCarrier,
        extractedLane: result.extractedLane,
        suggestedAction: result.suggestedAction,
        reasoning: result.reasoning,
        extractedEntities: result.extractedEntities,
      }).returning();

      cls = inserted ?? null;

      if (cls) {
        classified++;
        await db.insert(auditLogs).values({
          tenantId, actorType: "ai", actorName: "Clyde Autopilot",
          entityType: "email_thread", entityId: thread.id,
          action: "autopilot_classified",
          metadata: { category: result.category, confidence: result.confidence },
        });
      }
    }

    if (!cls) { skipped++; continue; }

    // Skip follow-up threads (customer confirmation, status check after resolution)
    if (cls.isFollowUp) {
      await db.insert(auditLogs).values({
        tenantId, actorType: "system", actorName: "Clyde Autopilot",
        entityType: "email_thread", entityId: thread.id,
        action: "autopilot_skipped",
        metadata: { reason: "follow_up_skip", followUpType: cls.followUpType },
      });
      skipped++; continue;
    }

    const category = cls.category;

    // Classify-only categories — stop here (not in SAFE_TO_AUTO_DRAFT)
    if (!SAFE_TO_AUTO_DRAFT.has(category) && requiresHumanApproval(category)) { skipped++; continue; }
    if (category === "escalation" || category === "unknown") { skipped++; continue; }

    // Skip if draft already exists and isn't rejected
    const existingDraft = await db.query.aiDrafts.findFirst({
      where: eq(aiDrafts.messageId, firstMsg.id),
      orderBy: [desc(aiDrafts.createdAt)],
    });
    if (existingDraft && existingDraft.status !== "rejected") { skipped++; continue; }

    // 2. Find matched load + SOPs
    const matchedLoad = cls.extractedLoadNumber
      ? await db.query.loads.findFirst({
          where: and(eq(loads.loadNumber, cls.extractedLoadNumber), eq(loads.tenantId, tenantId)),
        })
      : null;

    const sops = await db.select().from(sopRules).where(
      and(eq(sopRules.tenantId, tenantId), eq(sopRules.isActive, true), eq(sopRules.category, category)),
    );

    // 3. Generate draft body
    let draftBody: string;
    if (process.env.OPENAI_API_KEY) {
      const OpenAI = (await import("openai")).default;
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const context = [
        `Email subject: ${firstMsg.subject ?? "(none)"}`,
        `Email body:\n${firstMsg.body}`,
        matchedLoad
          ? `\nLoad #${matchedLoad.loadNumber} | ${matchedLoad.originCity}, ${matchedLoad.originState} → ${matchedLoad.destinationCity}, ${matchedLoad.destinationState} | Status: ${matchedLoad.currentStatus} | Carrier: ${matchedLoad.carrierName} | ETA: ${matchedLoad.eta?.toISOString() ?? "unknown"}`
          : "",
        sops.length ? `\nActive SOPs:\n${sops.map((s) => `- ${s.ruleText}`).join("\n")}` : "",
      ].filter(Boolean).join("\n");

      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are Clyde, a freight ops AI assistant. Draft a concise, professional reply for a freight brokerage operator. Never invent load details not provided. Keep it under 120 words. Include the load number if available. This was auto-generated overnight — do not say the email has been sent yet.",
          },
          { role: "user", content: context },
        ],
      });
      draftBody = completion.choices[0]?.message?.content ?? "Unable to generate draft.";
    } else {
      const ref = matchedLoad?.loadNumber ? `load #${matchedLoad.loadNumber}` : "your shipment";
      draftBody = `Thank you for reaching out regarding ${ref}. Our team has reviewed this and will follow up shortly with the information you requested.\n\nBest regards,\nClyde Freight Operations`;
    }

    const matchConfidence = matchedLoad ? 0.85 : 0;
    const isFollowUp = cls.isFollowUp ?? false;
    const isFullAuto = canAutoSend(category, matchConfidence, isFollowUp);

    const [insertedDraft] = await db.insert(aiDrafts).values({
      tenantId, messageId: firstMsg.id, loadId: matchedLoad?.id ?? null,
      draftSubject: `Re: ${firstMsg.subject ?? "Your inquiry"}`,
      draftBody, confidence: "0.85",
      approvalRequired: !isFullAuto,
      status: isFullAuto ? "approved" : "pending",
    }).returning({ id: aiDrafts.id });

    drafted++;

    await db.insert(auditLogs).values({
      tenantId, actorType: "ai", actorName: "Clyde Autopilot",
      entityType: "ai_draft", entityId: insertedDraft?.id ?? firstMsg.id,
      action: "autopilot_draft_generated",
      metadata: { category, isFullAuto, threadId: thread.id },
    });

    // 4. Full-auto: mark thread as sent
    if (isFullAuto && insertedDraft) {
      await db.update(emailThreads).set({ status: "sent" }).where(eq(emailThreads.id, thread.id));
      autoSent++;

      await db.insert(auditLogs).values({
        tenantId, actorType: "ai", actorName: "Clyde Autopilot",
        entityType: "email_thread", entityId: thread.id,
        action: "autopilot_auto_sent",
        metadata: { category, draftId: insertedDraft.id },
      });
    } else {
      // Draft-only: set to pending_review so human can approve
      await db.update(emailThreads).set({ status: "pending_review" }).where(eq(emailThreads.id, thread.id));
    }
  }

  revalidatePath("/app/inbox");
  return {
    total: openThreads.length,
    classified,
    drafted,
    autoSent,
    skipped,
    timestamp: new Date().toISOString(),
  };
}

// ─── Gmail Sync ───────────────────────────────────────────────────────────────

export async function syncGmailAction() {
  const tenantId = await getTenantId();
  const errors: string[] = [];
  let newThreads = 0;
  let newMessages = 0;

  if (!tenantId) return { newThreads, newMessages, errors: ["Missing DEMO_TENANT_ID."] };

  const inbox = await db.query.inboxes.findFirst({ where: eq(inboxes.tenantId, tenantId) });
  if (!inbox) return { newThreads, newMessages, errors: ["No inbox configured."] };

  const connection = await db.query.inboxConnections.findFirst({
    where: and(eq(inboxConnections.tenantId, tenantId), eq(inboxConnections.inboxId, inbox.id)),
  });
  if (!connection) return { newThreads, newMessages, errors: ["No Gmail connection. Connect Gmail in Settings."] };

  const { getGmailClient } = await import("@/lib/gmail");
  const { decodeBody, normalizeThread, parseHeaders } = await import("@/lib/gmail-sync");
  const gmail = await getGmailClient(tenantId);

  let list;
  try {
    list = await gmail.users.threads.list({ userId: "me", maxResults: 50, q: "is:unread OR newer_than:7d" });
  } catch (error) {
    const msg = String(error);
    if (msg.includes("401")) {
      try {
        await gmail.users.getProfile({ userId: "me" });
      } catch {
        if (connection) {
          await db.update(inboxConnections).set({ status: "disconnected" }).where(eq(inboxConnections.id, connection.id));
        }
        return { newThreads, newMessages, errors: ["Gmail auth expired. Reconnect inbox."] };
      }
    }
    return { newThreads, newMessages, errors: [`Gmail list failed: ${msg}`] };
  }

  const threadIds = (list.data.threads ?? []).map((t) => t.id).filter(Boolean) as string[];

  const existing = threadIds.length
    ? await db.query.emailThreads.findMany({ where: inArray(emailThreads.gmailThreadId, threadIds) })
    : [];
  const existingByGmailThreadId = new Map(existing.map((t) => [t.gmailThreadId, t]));

  for (const threadId of threadIds) {
    try {
      const full = await gmail.users.threads.get({ userId: "me", id: threadId, format: "full" });
      const normalized = normalizeThread(full.data);
      if (!normalized.gmailThreadId) continue;

      const knownThread = existingByGmailThreadId.get(normalized.gmailThreadId);
      const knownMessageIds = knownThread
        ? new Set((await db.query.emailMessages.findMany({ where: eq(emailMessages.threadId, knownThread.id) })).map((m) => m.gmailMessageId).filter(Boolean))
        : new Set<string>();

      let threadRowId = knownThread?.id;
      let threadLastAt = knownThread?.lastMessageAt ? new Date(knownThread.lastMessageAt) : null;

      if (!threadRowId) {
        const firstMessage = normalized.messages[0];
        const parsed = parseHeaders(firstMessage?.payload?.headers);
        const inserted = await db.insert(emailThreads).values({
          tenantId,
          inboxId: inbox.id,
          subject: parsed.subject,
          status: "open",
          priority: "normal",
          gmailThreadId: normalized.gmailThreadId,
          gmailHistoryId: normalized.gmailHistoryId,
          lastMessageAt: parsed.date,
        }).returning({ id: emailThreads.id });
        threadRowId = inserted[0].id;
        newThreads += 1;
      }

      for (const m of normalized.messages) {
        if (!m.id || knownMessageIds.has(m.id)) continue;
        const parsed = parseHeaders(m.payload?.headers);
        const direction = parsed.fromEmail === inbox.emailAddress.toLowerCase() ? "outbound" : "inbound";
        const body = decodeBody(m.payload);
        await db.insert(emailMessages).values({
          tenantId,
          threadId: threadRowId,
          direction,
          senderName: parsed.fromName,
          senderEmail: parsed.fromEmail || "unknown@example.com",
          recipientEmail: parsed.toEmail || inbox.emailAddress,
          subject: parsed.subject,
          gmailMessageId: m.id,
          body: body || "(Empty body)",
          receivedAt: parsed.date,
        });
        newMessages += 1;
        if (parsed.date && (!threadLastAt || parsed.date > threadLastAt)) threadLastAt = parsed.date;
      }

      // Reopen resolved/drafted threads when new inbound arrives
      const knownStatus = knownThread?.status;
      const hasNewInbound = normalized.messages.some((m) => {
        if (!m.id || knownMessageIds.has(m.id)) return false;
        const ph = parseHeaders(m.payload?.headers);
        return ph.fromEmail !== inbox.emailAddress.toLowerCase();
      });
      if (hasNewInbound && (knownStatus === "resolved" || knownStatus === "drafted")) {
        const currentThread = await db.query.emailThreads.findFirst({ where: eq(emailThreads.id, threadRowId) });
        await db.update(emailThreads).set({
          status: "open",
          priority: currentThread?.priority === "urgent" ? "urgent" : "normal",
          reopenedAt: new Date(),
          reopenCount: String(Number(currentThread?.reopenCount ?? "0") + 1),
          gmailHistoryId: normalized.gmailHistoryId,
          lastMessageAt: threadLastAt,
        }).where(eq(emailThreads.id, threadRowId));
        await db.insert(auditLogs).values({
          tenantId, actorType: "system", actorName: "Gmail Sync",
          entityType: "email_thread", entityId: threadRowId,
          action: "thread_reopened",
          metadata: { reason: "customer_replied_after_resolution" },
        });
      } else {
        await db.update(emailThreads).set({
          gmailHistoryId: normalized.gmailHistoryId,
          lastMessageAt: threadLastAt,
        }).where(eq(emailThreads.id, threadRowId));
      }
    } catch (error) {
      errors.push(`Thread ${threadId} failed: ${String(error)}`);
    }
  }

  if (connection) {
    await db.update(inboxConnections).set({ status: "connected", lastSyncAt: new Date() }).where(eq(inboxConnections.id, connection.id));
  }

  revalidatePath("/app/inbox");
  return { newThreads, newMessages, errors };
}

// ─── Gmail Send ───────────────────────────────────────────────────────────────

export async function sendDraftViaGmailAction(
  _prevState: { error?: string; success?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const draftId  = String(formData.get("draftId") ?? "");
  const threadId = String(formData.get("threadId") ?? "");
  if (!draftId || !threadId) return { error: "Missing draftId or threadId" };

  const thread = await db.query.emailThreads.findFirst({ where: eq(emailThreads.id, threadId) });
  if (!thread) return { error: "Thread not found" };
  if (thread.status === "sent" || thread.status === "resolved") return { error: "Thread is already closed for sending" };
  if (!thread.gmailThreadId) return { error: "Thread not connected to Gmail. Use manual send." };

  const { asc } = await import("drizzle-orm");
  const messages = await db.query.emailMessages.findMany({ where: eq(emailMessages.threadId, threadId), orderBy: [asc(emailMessages.receivedAt)] });
  const firstInbound = messages.find((m) => m.direction === "inbound");
  if (!firstInbound) return { error: "No inbound message found" };

  const classification = await db.query.aiClassifications.findFirst({ where: eq(aiClassifications.messageId, firstInbound.id) });
  if (classification?.category && NEVER_AUTO_SEND.has(classification.category)) {
    return { error: "Manual send required for this category" };
  }
  if (classification?.confidence !== null && classification?.confidence !== undefined && Number(classification.confidence) < 0.7) {
    return { error: "Low confidence - please review before sending" };
  }

  const draft = await db.query.aiDrafts.findFirst({ where: and(eq(aiDrafts.id, draftId), eq(aiDrafts.messageId, firstInbound.id)) });
  if (!draft) return { error: "Draft not found" };
  if (!(draft.status === "approved" || draft.status === "edited")) return { error: "Draft must be approved or edited before sending" };

  const inbox = await db.query.inboxes.findFirst({ where: eq(inboxes.id, thread.inboxId) });
  if (!inbox?.emailAddress) return { error: "Connected inbox address not found" };

  const lastInbound = [...messages].reverse().find((m) => m.direction === "inbound");
  const refs = messages.map((m) => m.gmailMessageId).filter((v): v is string => Boolean(v));

  const { buildRFC2822Message } = await import("@/lib/gmail-send");
  const raw = buildRFC2822Message({
    to: firstInbound.senderEmail,
    from: inbox.emailAddress,
    subject: draft.draftSubject ?? thread.subject,
    body: draft.draftBody,
    inReplyTo: lastInbound?.gmailMessageId,
    references: refs,
  });

  try {
    const { getGmailClient } = await import("@/lib/gmail");
    const gmail = await getGmailClient(thread.tenantId);
    const response = await gmail.users.messages.send({ userId: "me", requestBody: { raw, threadId: thread.gmailThreadId } });
    const gmailMessageId = response.data.id;
    if (!gmailMessageId) return { error: "Gmail send failed: missing message ID in response" };

    await db.update(aiDrafts).set({
      status: "sent",
      sentAt: new Date(),
      sentBy: "Marcus Webb",
      gmailSentMessageId: gmailMessageId,
      finalBody: draft.draftBody,
      updatedAt: new Date(),
    }).where(eq(aiDrafts.id, draft.id));

    await db.update(emailThreads).set({ status: "sent" }).where(eq(emailThreads.id, thread.id));

    await db.insert(emailMessages).values({
      tenantId: thread.tenantId,
      threadId: thread.id,
      direction: "outbound",
      senderName: "Marcus Webb",
      senderEmail: inbox.emailAddress,
      recipientEmail: firstInbound.senderEmail,
      subject: draft.draftSubject ?? thread.subject,
      body: draft.draftBody,
      gmailMessageId,
      receivedAt: new Date(),
    });

    await db.insert(auditLogs).values({
      tenantId: thread.tenantId,
      actorType: "user",
      actorName: "Marcus Webb",
      entityType: "ai_draft",
      entityId: draft.id,
      action: "draft_sent_via_gmail",
      metadata: { draftId: draft.id, gmailMessageId },
    });

    revalidatePath("/app/inbox");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { error: `Gmail send failed: ${message}` };
  }
}
