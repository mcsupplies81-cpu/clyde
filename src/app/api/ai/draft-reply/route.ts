import { NextResponse } from "next/server";
import { db } from "@/db";
import { aiDrafts, emailMessages, aiClassifications, loads, sopRules } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getTenantIdForUser } from "@/lib/auth";

const SYSTEM_PROMPT = `You are Clyde, a freight operations AI assistant. Generate a professional draft reply for a freight brokerage operator.

Rules:
- Address the reply to the SENDER of the email being replied to (use their name from "Sender name"). Never address it to the customer if the email came from a carrier, and vice versa.
- NEVER promise delivery times you cannot confirm
- If tracking is stale, say the team is confirming with the carrier
- If POD is unavailable, say it is pending and will be sent once received
- If detention/accessorial, do NOT admit fault or approve charges. Acknowledge receipt, say you are reviewing.
- If escalation, stay calm and acknowledge without over-committing
- Do NOT invent load details not provided
- Keep replies concise and professional
- Always include the load number in the reply if known
- Sign off as the ops team, not as an individual name
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
      `Sender name: ${message.senderName ?? message.senderEmail}`,
      `Sender email: ${message.senderEmail}`,
      `Email subject: ${message.subject ?? "(none)"}`,
      `Email body:\n${message.body}`,
      load ? `\nLoad context:\n- Load #: ${load.loadNumber}\n- Route: ${load.originCity}, ${load.originState} → ${load.destinationCity}, ${load.destinationState}\n- Status: ${load.currentStatus}\n- Customer: ${load.customerName}\n- Carrier: ${load.carrierName}\n- Driver: ${load.driverName ?? "TBD"} (${load.driverPhone ?? "N/A"})\n- ETA: ${load.eta ? load.eta.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "unknown"}\n- Risk: ${load.riskLevel}` : "",
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
      draftBody = mockDraft(classification?.category ?? "unknown", message.senderName ?? message.senderEmail, load ?? null);
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

function mockDraft(category: string, senderName: string, load: { loadNumber?: string | null; currentStatus?: string | null; eta?: Date | null } | null): string {
  const greeting = `Hi ${senderName.split(" ")[0]},`;
  const loadRef = load?.loadNumber ? `load #${load.loadNumber}` : "this shipment";
  const sign = "\n\nFreight Ops Team";
  switch (category) {
    case "status_request":
      return `${greeting}\n\nOur team is actively monitoring ${loadRef}. ${load?.currentStatus ? `Current status: ${load.currentStatus}.` : ""} We will provide an updated ETA as soon as we confirm with the carrier.${sign}`;
    case "pod_request":
      return `${greeting}\n\nThe POD for ${loadRef} is being retrieved from the carrier and will be sent over as soon as it is available — typically within 1–2 business hours.${sign}`;
    case "quote_request":
      return `${greeting}\n\nThank you for the lane inquiry. To get you an accurate quote, could you confirm the pickup date, commodity, and any special requirements? We'll follow up with pricing shortly.${sign}`;
    case "detention_accessorial":
      return `${greeting}\n\nThank you for the detention notice on ${loadRef}. We have received your request and are reviewing the timeline on our end. We will follow up with our determination shortly. Please hold all paperwork pending our review.${sign}`;
    case "escalation":
      return `${greeting}\n\nWe understand the urgency and are treating this as a priority. A member of our operations team will be in direct contact with you within the hour to work through a resolution.${sign}`;
    case "bol_request":
      return `${greeting}\n\nHappy to help — the BOL for ${loadRef} is attached. Let us know if you need anything else.${sign}`;
    case "carrier_update":
      return `${greeting}\n\nThank you for the update on ${loadRef}. Logged. Please send another check call when you are 2 hours out from delivery.${sign}`;
    default:
      return `${greeting}\n\nThank you for reaching out regarding ${loadRef}. Our team is reviewing and will follow up shortly.${sign}`;
  }
}
