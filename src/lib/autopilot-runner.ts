import { db } from "@/db";
import { emailThreads, emailMessages, aiClassifications, aiDrafts, auditLogs, sopRules, loads } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { mockClassify, openAiClassify } from "@/lib/ai-classifier";
import { canAutoSend, requiresHumanApproval, SAFE_TO_AUTO_DRAFT } from "@/lib/safety";

export type AutopilotRunResult = {
  total: number;
  classified: number;
  drafted: number;
  autoSent: number;
  skipped: number;
  errors: string[];
  timestamp: string;
};

export async function runAutopilot(tenantId: string, options?: { dryRun?: boolean }): Promise<AutopilotRunResult> {
  const dryRun = options?.dryRun ?? false;
  let classified = 0, drafted = 0, autoSent = 0, skipped = 0;
  const errors: string[] = [];

  const openThreads = await db.query.emailThreads.findMany({
    where: and(eq(emailThreads.tenantId, tenantId), eq(emailThreads.status, "open")),
    limit: 50,
  });

  for (const thread of openThreads) {
    try {
      const firstMsg = await db.query.emailMessages.findFirst({
        where: and(eq(emailMessages.threadId, thread.id), eq(emailMessages.direction, "inbound")),
      });
      if (!firstMsg) { skipped++; continue; }

      let cls = await db.query.aiClassifications.findFirst({
        where: eq(aiClassifications.messageId, firstMsg.id),
        orderBy: [desc(aiClassifications.createdAt)],
      });

      if (!cls) {
        const input = { messageId: firstMsg.id, subject: firstMsg.subject ?? "", body: firstMsg.body, senderName: firstMsg.senderName ?? "", senderEmail: firstMsg.senderEmail };
        const result = process.env.OPENAI_API_KEY ? await openAiClassify(input) : mockClassify(input);

        if (!dryRun) {
          await db.delete(aiClassifications).where(eq(aiClassifications.messageId, firstMsg.id));
          const [inserted] = await db.insert(aiClassifications).values({
            tenantId, messageId: firstMsg.id,
            category: result.category, urgency: result.urgency, confidence: String(result.confidence),
            extractedLoadNumber: result.extractedLoadNumber, extractedPoNumber: result.extractedPoNumber,
            extractedCustomer: result.extractedCustomer, extractedCarrier: result.extractedCarrier,
            extractedLane: result.extractedLane, suggestedAction: result.suggestedAction,
            reasoning: result.reasoning, extractedEntities: result.extractedEntities,
          }).returning();
          cls = inserted ?? null;
        }
        if (cls) classified++;
      }

      if (!cls || dryRun) { if (!cls) skipped++; continue; }

      if (cls.isFollowUp) { skipped++; continue; }

      const category = cls.category;
      if (!SAFE_TO_AUTO_DRAFT.has(category) && requiresHumanApproval(category)) { skipped++; continue; }
      if (category === "escalation" || category === "unknown") { skipped++; continue; }

      const existingDraft = await db.query.aiDrafts.findFirst({
        where: eq(aiDrafts.messageId, firstMsg.id), orderBy: [desc(aiDrafts.createdAt)],
      });
      if (existingDraft && existingDraft.status !== "rejected") { skipped++; continue; }

      const matchedLoad = cls.extractedLoadNumber
        ? await db.query.loads.findFirst({ where: and(eq(loads.loadNumber, cls.extractedLoadNumber), eq(loads.tenantId, tenantId)) })
        : null;
      const sops = await db.select().from(sopRules).where(and(eq(sopRules.tenantId, tenantId), eq(sopRules.isActive, true), eq(sopRules.category, category)));

      let draftBody: string;
      if (process.env.OPENAI_API_KEY) {
        const OpenAI = (await import("openai")).default;
        const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const context = [
          `Email subject: ${firstMsg.subject ?? "(none)"}`, `Email body:\n${firstMsg.body}`,
          matchedLoad ? `\nLoad #${matchedLoad.loadNumber} | ${matchedLoad.originCity}, ${matchedLoad.originState} → ${matchedLoad.destinationCity}, ${matchedLoad.destinationState} | Status: ${matchedLoad.currentStatus}` : "",
          sops.length ? `\nActive SOPs:\n${sops.map((s) => `- ${s.ruleText}`).join("\n")}` : "",
        ].filter(Boolean).join("\n");
        const completion = await client.chat.completions.create({
          model: "gpt-4o-mini", messages: [{ role: "system", content: "You are Clyde, a freight ops AI. Draft a concise professional reply under 120 words." }, { role: "user", content: context }],
        });
        draftBody = completion.choices[0]?.message?.content ?? "Unable to generate draft.";
      } else {
        const ref = matchedLoad?.loadNumber ? `load #${matchedLoad.loadNumber}` : "your shipment";
        draftBody = `Thank you for reaching out regarding ${ref}. Our team has reviewed this and will follow up shortly.`;
      }

      const matchConfidence = matchedLoad ? 0.85 : 0;
      const isFullAuto = canAutoSend(category, matchConfidence, cls.isFollowUp ?? false);

      const [insertedDraft] = await db.insert(aiDrafts).values({
        tenantId, messageId: firstMsg.id, loadId: matchedLoad?.id ?? null,
        draftSubject: `Re: ${firstMsg.subject ?? "Your inquiry"}`, draftBody, confidence: "0.85",
        approvalRequired: !isFullAuto, status: isFullAuto ? "approved" : "pending",
      }).returning({ id: aiDrafts.id });

      drafted++;

      await db.insert(auditLogs).values({
        tenantId, actorType: "ai", actorName: "Clyde Scheduled Autopilot",
        entityType: "email_thread", entityId: thread.id,
        action: isFullAuto ? "autopilot_auto_sent" : "autopilot_needs_review",
        metadata: { category, isFullAuto, draftId: insertedDraft?.id },
      });

      if (isFullAuto && insertedDraft) {
        await db.update(emailThreads).set({ status: "sent" }).where(eq(emailThreads.id, thread.id));
        autoSent++;
      } else {
        await db.update(emailThreads).set({ status: "pending_review" }).where(eq(emailThreads.id, thread.id));
      }
    } catch (err) {
      errors.push(`Thread ${thread.id}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  return { total: openThreads.length, classified, drafted, autoSent, skipped, errors, timestamp: new Date().toISOString() };
}
