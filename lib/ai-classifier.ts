export const VALID_CATEGORIES = [
  "status_request",
  "quote_request",
  "pod_request",
  "bol_request",
  "rate_confirmation",
  "carrier_update",
  "appointment_change",
  "detention_accessorial",
  "billing_invoice",
  "escalation",
  "unknown",
] as const;

export const VALID_URGENCIES = ["low", "normal", "high", "critical"] as const;

type Category = (typeof VALID_CATEGORIES)[number];
type Urgency = (typeof VALID_URGENCIES)[number];

export type ClassifyInput = {
  messageId: string;
  subject: string;
  body: string;
  senderName: string;
  senderEmail: string;
};

export type Classification = {
  category: Category;
  urgency: Urgency;
  confidence: number;
  extractedLoadNumber: string | null;
  extractedPoNumber: string | null;
  extractedCustomer: string | null;
  extractedCarrier: string | null;
  extractedLane: string | null;
  suggestedAction: string;
  reasoning: string;
};

const SYSTEM_PROMPT =
  "You are Clyde, a freight operations email classifier. Classify inbound logistics emails for a freight brokerage. Extract freight entities accurately. Be conservative. If uncertain, use unknown and lower confidence.";

function extract(regex: RegExp, text: string): string | null {
  return text.match(regex)?.[1]?.trim() ?? null;
}

export function mockClassify(input: ClassifyInput): Classification {
  const text = `${input.subject}\n${input.body}`.toLowerCase();
  const mapping: Array<{ keywords: string[]; category: Category; suggestedAction: string }> = [
    { keywords: ["status", "eta", "update"], category: "status_request", suggestedAction: "Send latest shipment status update." },
    { keywords: ["quote", "rate request", "pricing"], category: "quote_request", suggestedAction: "Prepare and send rate quote." },
    { keywords: ["pod", "proof of delivery"], category: "pod_request", suggestedAction: "Share POD document if available." },
    { keywords: ["bol", "bill of lading"], category: "bol_request", suggestedAction: "Provide BOL copy." },
    { keywords: ["invoice", "billing"], category: "billing_invoice", suggestedAction: "Route to billing team." },
    { keywords: ["detention", "lumper", "tonu", "accessorial"], category: "detention_accessorial", suggestedAction: "Review and validate accessorial request." },
    { keywords: ["escalate", "urgent", "manager"], category: "escalation", suggestedAction: "Escalate to operations lead immediately." },
  ];

  const hit = mapping.find((rule) => rule.keywords.some((k) => text.includes(k)));
  const urgency: Urgency = text.includes("critical") || text.includes("asap") ? "critical" : text.includes("urgent") ? "high" : "normal";

  return {
    category: hit?.category ?? "unknown",
    urgency,
    confidence: hit ? 0.82 : 0.42,
    extractedLoadNumber: extract(/(?:load|ld)\s*#?\s*([a-z0-9-]+)/i, `${input.subject} ${input.body}`),
    extractedPoNumber: extract(/\bpo\s*#?\s*([a-z0-9-]+)/i, `${input.subject} ${input.body}`),
    extractedCustomer: extract(/customer\s*:?\s*([^\n,]+)/i, input.body),
    extractedCarrier: extract(/carrier\s*:?\s*([^\n,]+)/i, input.body) ?? input.senderName || null,
    extractedLane: extract(/\b([A-Za-z ]+\s*(?:to|-|→)\s*[A-Za-z ]+)\b/, input.body),
    suggestedAction: hit?.suggestedAction ?? "Review manually; insufficient signal for deterministic classification.",
    reasoning: hit
      ? `Keyword match found for ${hit.category}.`
      : "No strong keyword pattern found; conservative unknown classification.",
  };
}

export async function openAiClassify(input: ClassifyInput): Promise<Classification> {
  const prompt = `Classify this email and return strict JSON only with keys: category, urgency, confidence, extractedLoadNumber, extractedPoNumber, extractedCustomer, extractedCarrier, extractedLane, suggestedAction, reasoning. Email:\n${JSON.stringify(
    input,
  )}`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: process.env.OPENAI_MODEL ?? "gpt-4o-mini", input: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: prompt }] }),
  });

  if (!response.ok) throw new Error(`OpenAI request failed: ${response.status}`);
  const json = (await response.json()) as { output_text?: string };
  const raw = json.output_text ?? "{}";
  const parsed: unknown = JSON.parse(raw);
  return validateClassification(parsed);
}

export function validateClassification(value: unknown): Classification {
  if (!value || typeof value !== "object") throw new Error("Invalid classification object");
  const v = value as Record<string, unknown>;
  const category = String(v.category);
  const urgency = String(v.urgency);
  if (!VALID_CATEGORIES.includes(category as Category)) throw new Error("Invalid category");
  if (!VALID_URGENCIES.includes(urgency as Urgency)) throw new Error("Invalid urgency");

  return {
    category: category as Category,
    urgency: urgency as Urgency,
    confidence: Math.max(0, Math.min(1, Number(v.confidence) || 0)),
    extractedLoadNumber: v.extractedLoadNumber ? String(v.extractedLoadNumber) : null,
    extractedPoNumber: v.extractedPoNumber ? String(v.extractedPoNumber) : null,
    extractedCustomer: v.extractedCustomer ? String(v.extractedCustomer) : null,
    extractedCarrier: v.extractedCarrier ? String(v.extractedCarrier) : null,
    extractedLane: v.extractedLane ? String(v.extractedLane) : null,
    suggestedAction: String(v.suggestedAction ?? "Review manually."),
    reasoning: String(v.reasoning ?? "No reasoning provided."),
  };
}
