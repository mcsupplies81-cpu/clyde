export const CATEGORIES = [
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

export const URGENCIES = ["low", "normal", "high", "critical"] as const;

export type Category = (typeof CATEGORIES)[number];
export type Urgency = (typeof URGENCIES)[number];

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
  "You are Clyde, a freight operations email classifier. Classify inbound logistics emails for a freight brokerage. Extract freight entities accurately. Be conservative. If uncertain, use unknown and lower confidence. Return strict JSON only.";

function extract(re: RegExp, text: string): string | null {
  return text.match(re)?.[1]?.trim() ?? null;
}

export function mockClassify(input: ClassifyInput): Classification {
  const text = `${input.subject}\n${input.body}`.toLowerCase();

  const rules: Array<{ keywords: string[]; category: Category; action: string }> = [
    { keywords: ["status", "eta", "update", "where is", "location"], category: "status_request", action: "Send latest shipment status." },
    { keywords: ["quote", "rate request", "pricing", "how much"], category: "quote_request", action: "Prepare and send rate quote." },
    { keywords: ["pod", "proof of delivery"], category: "pod_request", action: "Share POD document if available." },
    { keywords: ["bol", "bill of lading"], category: "bol_request", action: "Provide BOL copy." },
    { keywords: ["rate con", "rate confirmation", "ratecon"], category: "rate_confirmation", action: "Send rate confirmation document." },
    { keywords: ["appointment", "appt", "schedule", "reschedule"], category: "appointment_change", action: "Confirm or update appointment." },
    { keywords: ["detention", "lumper", "tonu", "accessorial", "layover"], category: "detention_accessorial", action: "Review accessorial request before responding." },
    { keywords: ["invoice", "billing", "payment", "remittance"], category: "billing_invoice", action: "Route to billing team." },
    { keywords: ["escalate", "manager", "unacceptable", "furious", "lawsuit"], category: "escalation", action: "Escalate to operations lead immediately." },
    { keywords: ["check call", "driver update", "in transit", "picked up", "delivered"], category: "carrier_update", action: "Log update and notify customer if needed." },
  ];

  const hit = rules.find((r) => r.keywords.some((k) => text.includes(k)));
  const urgency: Urgency = text.includes("critical") || text.includes("asap") ? "critical"
    : text.includes("urgent") || text.includes("immediately") ? "high"
    : "normal";
  const full = `${input.subject} ${input.body}`;

  return {
    category: hit?.category ?? "unknown",
    urgency,
    confidence: hit ? 0.82 : 0.42,
    extractedLoadNumber: extract(/(?:load|ld)\s*#?\s*([a-z]{2,4}[-\s]?\d+)/i, full),
    extractedPoNumber: extract(/\bpo\s*#?\s*([a-z0-9-]+)/i, full),
    extractedCustomer: extract(/customer\s*:?\s*([^\n,]+)/i, input.body),
    extractedCarrier: extract(/carrier\s*:?\s*([^\n,]+)/i, input.body) ?? input.senderName || null,
    extractedLane: extract(/([A-Za-z ]+\s*(?:to|-|→)\s*[A-Za-z ]+)/, input.body),
    suggestedAction: hit?.action ?? "Review manually — insufficient signal for classification.",
    reasoning: hit ? `Keyword match on category: ${hit.category}.` : "No strong pattern. Conservative unknown.",
  };
}

export function validateClassification(v: unknown): Classification {
  if (!v || typeof v !== "object") throw new Error("Invalid classification response");
  const o = v as Record<string, unknown>;
  const category = String(o.category ?? "");
  const urgency = String(o.urgency ?? "");
  if (!CATEGORIES.includes(category as Category)) throw new Error(`Invalid category: ${category}`);
  if (!URGENCIES.includes(urgency as Urgency)) throw new Error(`Invalid urgency: ${urgency}`);
  return {
    category: category as Category,
    urgency: urgency as Urgency,
    confidence: Math.max(0, Math.min(1, Number(o.confidence) || 0)),
    extractedLoadNumber: o.extractedLoadNumber ? String(o.extractedLoadNumber) : null,
    extractedPoNumber: o.extractedPoNumber ? String(o.extractedPoNumber) : null,
    extractedCustomer: o.extractedCustomer ? String(o.extractedCustomer) : null,
    extractedCarrier: o.extractedCarrier ? String(o.extractedCarrier) : null,
    extractedLane: o.extractedLane ? String(o.extractedLane) : null,
    suggestedAction: String(o.suggestedAction ?? "Review manually."),
    reasoning: String(o.reasoning ?? ""),
  };
}

export async function openAiClassify(input: ClassifyInput): Promise<Classification> {
  const OpenAI = (await import("openai")).default;
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const completion = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Classify this freight email:\nSubject: ${input.subject}\nFrom: ${input.senderName} <${input.senderEmail}>\n\n${input.body}` },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  return validateClassification(JSON.parse(raw));
}
