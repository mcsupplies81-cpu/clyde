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
  "carrier_concern",
  "unknown",
] as const;

export const URGENCIES = ["low", "normal", "high", "critical"] as const;

export type Category = (typeof CATEGORIES)[number];
export type Urgency = (typeof URGENCIES)[number];

export type ExtractedEntities = {
  intent?: string | null;
  facility?: string | null;
  origin?: string | null;
  destination?: string | null;
  requestedDocument?: string | null;
  issueType?: string | null;
  requestedAction?: string | null;
  deadline?: string | null;
  appointmentTime?: string | null;
};

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
  extractedEntities: ExtractedEntities;
};

const SYSTEM_PROMPT =
  "You are Clyde, a freight operations email classifier. Classify inbound logistics emails for a freight brokerage. Extract freight entities accurately. Be conservative. If uncertain, use unknown and lower confidence. Return strict JSON only.";

function extract(re: RegExp, text: string): string | null {
  return text.match(re)?.[1]?.trim() ?? null;
}

function extractEntities(category: Category, subject: string, body: string): ExtractedEntities {
  const full = `${subject}\n${body}`;

  const intentMap: Partial<Record<Category, string>> = {
    status_request: "Request shipment status update",
    pod_request: "Request Proof of Delivery (POD)",
    bol_request: "Request Bill of Lading (BOL)",
    rate_confirmation: "Request rate confirmation",
    carrier_update: "Carrier / driver status check-in",
    appointment_change: "Request appointment reschedule",
    detention_accessorial: "Submit detention or accessorial charge",
    billing_invoice: "Billing or invoice inquiry",
    escalation: "Urgent escalation request",
    quote_request: "Request freight rate quote",
    carrier_concern: "Carrier compliance / re-brokering concern",
  };

  return {
    intent: intentMap[category] ?? null,
    facility: extract(/(?:facility|warehouse|dock|terminal)\s*:?\s*([^\n,]+)/i, full),
    origin: extract(/(?:origin|pickup|from)\s*:?\s*([A-Za-z ,]+(?:,\s*[A-Z]{2})?)/i, full),
    destination: extract(/(?:destination|delivery|to)\s*:?\s*([A-Za-z ,]+(?:,\s*[A-Z]{2})?)/i, full),
    requestedDocument:
      category === "pod_request" ? "POD"
      : category === "bol_request" ? "BOL"
      : category === "rate_confirmation" ? "Rate Confirmation"
      : extract(/(?:document|form|file)\s*:?\s*([^\n,]+)/i, full),
    issueType:
      category === "escalation"
        ? extract(/(?:issue|problem|complaint|concern)\s*:?\s*([^\n.]+)/i, full) ?? "Customer escalation"
        : category === "detention_accessorial"
        ? extract(/(?:detention|lumper|tonu|layover|accessorial)/i, full) ?? "Accessorial charge"
        : null,
    requestedAction: extract(/(?:please|can you|could you|need you to)\s+([^\n.?]+)/i, full),
    deadline: extract(/(?:by|before|due|needed by|deadline)\s*:?\s*([^\n,]+)/i, full),
    appointmentTime:
      category === "appointment_change"
        ? extract(/(?:appt|appointment)\s*(?:time|date|at)?\s*:?\s*([^\n,]+)/i, full)
        : null,
  };
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
    { keywords: ["re-broker", "rebrok", "substitute carrier", "double broker", "partner carrier", "cannot cover", "drop the load", "give to another", "pass to another"], category: "carrier_concern", action: "Review carrier compliance issue — requires human approval before responding." },
  ];

  const hit = rules.find((r) => r.keywords.some((k) => text.includes(k)));
  const urgency: Urgency =
    text.includes("critical") || text.includes("asap") ? "critical"
    : text.includes("urgent") || text.includes("immediately") ? "high"
    : "normal";
  const full = `${input.subject} ${input.body}`;
  const category = hit?.category ?? "unknown";

  return {
    category,
    urgency,
    confidence: hit ? 0.82 : 0.42,
    extractedLoadNumber: extract(/(?:load|ld)\s*#?\s*([a-z]{2,4}[-\s]?\d+)/i, full),
    extractedPoNumber: extract(/\bpo\s*#?\s*([a-z0-9-]+)/i, full),
    extractedCustomer: extract(/customer\s*:?\s*([^\n,]+)/i, input.body),
    extractedCarrier: (extract(/carrier\s*:?\s*([^\n,]+)/i, input.body) ?? input.senderName) || null,
    extractedLane: extract(/([A-Za-z ]+\s*(?:to|-|→)\s*[A-Za-z ]+)/, input.body),
    suggestedAction: hit?.action ?? "Review manually — insufficient signal for classification.",
    reasoning: hit ? `Keyword match on category: ${hit.category}.` : "No strong pattern. Conservative unknown.",
    extractedEntities: extractEntities(category, input.subject, input.body),
  };
}

export function validateClassification(v: unknown): Classification {
  if (!v || typeof v !== "object") throw new Error("Invalid classification response");
  const o = v as Record<string, unknown>;
  const category = String(o.category ?? "");
  const urgency = String(o.urgency ?? "");
  if (!CATEGORIES.includes(category as Category)) throw new Error(`Invalid category: ${category}`);
  if (!URGENCIES.includes(urgency as Urgency)) throw new Error(`Invalid urgency: ${urgency}`);

  // Parse extractedEntities from OpenAI response
  let extractedEntities: ExtractedEntities = {};
  if (o.extractedEntities && typeof o.extractedEntities === "object") {
    const ee = o.extractedEntities as Record<string, unknown>;
    extractedEntities = {
      intent: ee.intent ? String(ee.intent) : null,
      facility: ee.facility ? String(ee.facility) : null,
      origin: ee.origin ? String(ee.origin) : null,
      destination: ee.destination ? String(ee.destination) : null,
      requestedDocument: ee.requestedDocument ? String(ee.requestedDocument) : null,
      issueType: ee.issueType ? String(ee.issueType) : null,
      requestedAction: ee.requestedAction ? String(ee.requestedAction) : null,
      deadline: ee.deadline ? String(ee.deadline) : null,
      appointmentTime: ee.appointmentTime ? String(ee.appointmentTime) : null,
    };
  }

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
    extractedEntities,
  };
}

export async function openAiClassify(input: ClassifyInput): Promise<Classification> {
  const OpenAI = (await import("openai")).default;
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const prompt = `Classify this freight brokerage email. Return JSON only with exactly these keys:
{
  "category": one of [${CATEGORIES.join(", ")}],
  "urgency": one of [${URGENCIES.join(", ")}],
  "confidence": number 0-1,
  "extractedLoadNumber": string or null,
  "extractedPoNumber": string or null,
  "extractedCustomer": string or null,
  "extractedCarrier": string or null,
  "extractedLane": string or null,
  "suggestedAction": string,
  "reasoning": string,
  "extractedEntities": {
    "intent": string or null,
    "facility": string or null,
    "origin": string or null,
    "destination": string or null,
    "requestedDocument": string or null,
    "issueType": string or null,
    "requestedAction": string or null,
    "deadline": string or null,
    "appointmentTime": string or null
  }
}

Email:
Subject: ${input.subject}
From: ${input.senderName} <${input.senderEmail}>
Body: ${input.body}`;

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    return validateClassification(JSON.parse(raw));
  } catch {
    return mockClassify(input);
  }
}
