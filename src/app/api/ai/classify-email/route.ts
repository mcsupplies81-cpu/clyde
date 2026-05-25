import { NextResponse } from "next/server";
import { mockClassify, openAiClassify, type ClassifyInput } from "@/lib/ai-classifier";
import { db } from "@/db";
import { aiClassifications } from "@/db/schema";

function validateInput(body: unknown): ClassifyInput {
  if (!body || typeof body !== "object") throw new Error("Invalid body");
  const b = body as Record<string, unknown>;
  for (const k of ["messageId", "subject", "body", "senderName", "senderEmail"] as const) {
    if (typeof b[k] !== "string") throw new Error(`Missing: ${k}`);
  }
  return b as unknown as ClassifyInput;
}

export async function POST(request: Request) {
  try {
    const input = validateInput(await request.json());
    const tenantId = process.env.DEMO_TENANT_ID ?? "";

    const classification = process.env.OPENAI_API_KEY
      ? await openAiClassify(input)
      : mockClassify(input);

    if (tenantId) {
      await db.insert(aiClassifications).values({
        tenantId,
        messageId: input.messageId,
        category: classification.category,
        urgency: classification.urgency,
        confidence: String(classification.confidence),
        extractedLoadNumber: classification.extractedLoadNumber,
        extractedPoNumber: classification.extractedPoNumber,
        extractedCustomer: classification.extractedCustomer,
        extractedCarrier: classification.extractedCarrier,
        extractedLane: classification.extractedLane,
        suggestedAction: classification.suggestedAction,
        reasoning: classification.reasoning,
      });
    }

    return NextResponse.json(classification);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
