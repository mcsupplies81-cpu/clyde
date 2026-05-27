import { NextResponse } from "next/server";
import { db } from "@/db";
import { aiDrafts, emailMessages, aiClassifications, loads, sopRules } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getTenantIdForUser } from "@/lib/auth";

const SYSTEM_PROMPT = `You are Clyde, a freight operations AI assistant. Generate a professional draft reply for a freight brokerage operator.

Rules:
- NEVER promise delivery times you cannot confirm
- If tracking is stale, say the team is confirming with the carrier
- If POD is unavailable, say it is pending and will be sent once received
- If detention/accessorial, do NOT admit fault or approve charges
- If escalation, stay calm and acknowledge without over-committing
- Do NOT invent load details not provided
- Keep replies concise and professional
- Always include the load number in the reply if known
- Approval is always required before sending`;

export async function POST(request: Request) {
  try {
    const body = await request.json() as { messageId: string; classificationId?: string; loadId?: string };
    const tenantId = (await getTenantIdForUser()) ?? "";

    const [message] = await db.select().from(emailMessages).where(eq(emailMessages.id, body.messageId)).limit(1);
    if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });

    const [classification] = body.classificationId
      ? await db.select().from(aiClassifications).where(eq(aiClassifications.id, body.classificationId)).limit(1)
      : [];

    const [load] = body.loadId
      ? await db.select().from(loads).where(eq(loads.id, body.loadId)).limit(1)
      : [];

    const relevantSops = classification?.category
      ? await db.select().from(sopRules).where(
          and(eq(sopRules.tenantId, tenantId), eq(sopRules.isActive, true), eq(sopRules.category, classification.category))
        )
      : [];

    const contextParts = [
      `Email subject: ${message.subject ?? "(none)"}`,
      `Email body:\n${message.body}`,
      load ? `\nLoad context:\n- Load #: ${load.loadNumber}\n- Route: ${load.originCity}, ${load.originState} → ${load.destinationCity}, ${load.destinationState}\n- Status: ${load.currentStatus}\n- Carrier: ${load.carrierName}\n- Driver: ${load.driverName} (${load.driverPhone})\n- ETA: ${load.eta?.toISOString() ?? "unknown"}\n- Risk: ${load.riskLevel}` : "",
      relevantSops.length > 0 ? `\nActive SOPs for this category:\n${relevantSops.map((s) => `- ${s.ruleText}`).join("\n")}` : "",
    ].filter(Boolean).join("\n");

    let draftBody: string;
    let draftSubject: string;
    let confidence: number;

    if (process.env.OPENAI_API_KEY) {
      const OpenAI = (await import("openai")).default;
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const completion = await client.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Generate a draft reply.\n\n${contextParts}` },
        ],
      });
      draftBody = completion.choices[0]?.message?.content ?? "Unable to generate draft.";
      draftSubject = `Re: ${message.subject ?? "Your inquiry"}`;
      confidence = 0.85;
    } else {
      draftBody = mockDraft(classification?.category ?? "unknown", load ?? null);
      draftSubject = `Re: ${message.subject ?? "Your inquiry"}`;
      confidence = 0.72;
    }

    const [draft] = await db.insert(aiDrafts).values({
      tenantId,
      messageId: message.id,
      loadId: load?.id ?? null,
      draftSubject,
      draftBody,
      confidence: String(confidence),
      approvalRequired: true,
      status: "pending",
    }).returning();

    return NextResponse.json({ draft, approvalRequired: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

function mockDraft(category: string, load: { loadNumber?: string | null; currentStatus?: string | null; eta?: Date | null } | null): string {
  const loadRef = load?.loadNumber ? `load #${load.loadNumber}` : "your shipment";
  switch (category) {
    case "status_request":
      return `Thank you for reaching out. Our team is actively monitoring ${loadRef}. ${load?.currentStatus ? `Current status: ${load.currentStatus}.` : ""} We will provide an updated ETA as soon as we confirm with the carrier. We appreciate your patience.`;
    case "pod_request":
      return `Thank you for your request. The POD for ${loadRef} is being retrieved from the carrier. We will send it to you as soon as it is available. If you need this urgently, please let us know.`;
    case "quote_request":
      return `Thank you for the lane inquiry. We are reviewing your requirements and will have a competitive rate back to you shortly. Please confirm the pickup date, equipment type, and any special requirements so we can provide an accurate quote.`;
    case "detention_accessorial":
      return `Thank you for bringing this to our attention. We are reviewing the detention request for ${loadRef} with our carrier. We will follow up with details once we have confirmed the timeline on our end. Please hold any paperwork until we have completed our review.`;
    case "escalation":
      return `Thank you for reaching out. We understand the urgency and take this situation seriously. A member of our operations team will be in touch with you within the hour to address this directly. We apologize for any inconvenience.`;
    default:
      return `Thank you for your message. Our team is reviewing your request for ${loadRef} and will follow up shortly. Please do not hesitate to contact us if you need immediate assistance.`;
  }
}
