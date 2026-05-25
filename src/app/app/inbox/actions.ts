"use server";

import { db } from "@/db";
import {
  emailThreads, emailMessages, loads,
  aiClassifications, aiDrafts, auditLogs, sopRules,
} from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { mockClassify, openAiClassify } from "@/lib/ai-classifier";

function getTenantId() {
  return process.env.DEMO_TENANT_ID ?? "";
}

export async function classifyMessageAction(formData: FormData) {
  const tenantId = getTenantId();
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
  const tenantId = getTenantId();
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
  const sops = cls?.category
    ? await db.select().from(sopRules).where(
        and(eq(sopRules.tenantId, tenantId), eq(sopRules.isActive, true), eq(sopRules.category, cls.category)),
      )
    : [];

  let draftBody: string;
  if (process.env.OPENAI_API_KEY) {
    const OpenAI = (await import("openai")).default;
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const context = [
      `Email subject: ${message.subject ?? "(none)"}`,
      `Email body:\n${message.body}`,
      load
        ? `\nLoad #${load.loadNumber} | ${load.originCity}, ${load.originState} → ${load.destinationCity}, ${load.destinationState} | Status: ${load.currentStatus} | Carrier: ${load.carrierName} | ETA: ${load.eta?.toISOString() ?? "unknown"} | Risk: ${load.riskLevel}`
        : "",
      sops.length ? `\nActive SOPs:\n${sops.map((s) => `- ${s.ruleText}`).join("\n")}` : "",
    ].filter(Boolean).join("\n");

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are Clyde, a freight ops AI assistant. Draft a concise, professional reply for a freight brokerage operator to send to a customer or carrier. Never invent load details not provided. Keep it under 120 words. Always include the load number if available. Human approval is required before sending — do not say it has been sent.",
        },
        { role: "user", content: context },
      ],
    });
    draftBody = completion.choices[0]?.message?.content ?? "Unable to generate draft.";
  } else {
    const ref = load?.loadNumber ? `load #${load.loadNumber}` : "your shipment";
    draftBody = `Thank you for reaching out regarding ${ref}. Our team is reviewing this and will follow up shortly with the information you requested.`;
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
  const tenantId = getTenantId();
  const draftId  = String(formData.get("draftId") ?? "");
  const threadId = formData.get("threadId") ? String(formData.get("threadId")) : undefined;
  if (!draftId) return;

  await db.update(aiDrafts).set({ status: "approved", updatedAt: new Date() }).where(eq(aiDrafts.id, draftId));
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
  const tenantId = getTenantId();
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
  const tenantId = getTenantId();
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
  const tenantId = getTenantId();
  const tid = String(formData.get("threadId") ?? "");
  if (!tid) return;
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

export async function resolveThreadAction(formData: FormData) {
  const tenantId = getTenantId();
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

export async function escalateThreadAction(formData: FormData) {
  const tenantId = getTenantId();
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

// Full-auto: classify → draft → approve → mark sent (no human needed)
const AUTOPILOT_FULL_AUTO = new Set([
  "status_request", "carrier_update", "bol_request", "pod_request", "rate_confirmation",
]);
// Draft-only: classify → draft (requires human approval)
const AUTOPILOT_DRAFT_ONLY = new Set([
  "detention_accessorial", "billing_invoice", "appointment_change", "quote_request",
]);
// escalation, unknown → classify only, no draft

export type AutopilotResult = {
  total: number;
  classified: number;
  drafted: number;
  autoSent: number;
  skipped: number;
  timestamp: string;
};

export async function runAutopilotAction(): Promise<AutopilotResult> {
  const tenantId = getTenantId();
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

    const category = cls.category;

    // Classify-only categories — stop here
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

    const isFullAuto = AUTOPILOT_FULL_AUTO.has(category);

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
