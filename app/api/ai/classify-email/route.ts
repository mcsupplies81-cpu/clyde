import { NextResponse } from "next/server";
import { mockClassify, openAiClassify, validateClassification, type ClassifyInput } from "@/lib/ai-classifier";
import { saveClassification } from "@/lib/ai-classification-store";

function validateInput(body: unknown): ClassifyInput {
  if (!body || typeof body !== "object") throw new Error("Invalid request body");
  const b = body as Record<string, unknown>;
  const required = ["messageId", "subject", "body", "senderName", "senderEmail"] as const;
  for (const key of required) {
    if (!b[key] || typeof b[key] !== "string") {
      throw new Error(`Invalid ${key}`);
    }
  }
  return {
    messageId: b.messageId as string,
    subject: b.subject as string,
    body: b.body as string,
    senderName: b.senderName as string,
    senderEmail: b.senderEmail as string,
  };
}

export async function POST(request: Request) {
  try {
    const input = validateInput(await request.json());
    const classification = process.env.OPENAI_API_KEY ? await openAiClassify(input) : validateClassification(mockClassify(input));
    await saveClassification(input, classification);
    return NextResponse.json(classification);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
