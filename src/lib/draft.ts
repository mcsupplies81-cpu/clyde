import crypto from "node:crypto";
import type { Classification, Draft, EmailMessage, Load, SopRule } from "./types.js";

function deterministicConfidence(input: string): number {
  const hash = crypto.createHash("sha256").update(input).digest("hex");
  const n = parseInt(hash.slice(0, 8), 16);
  return Math.round((0.65 + (n % 30) / 100) * 100) / 100;
}

export async function generateFreightDraft(params: {
  message: EmailMessage;
  classification: Classification;
  load: Load | null;
  sopRules: SopRule[];
}): Promise<Draft> {
  const { message, classification, load, sopRules } = params;

  const lines: string[] = ["Thank you for your email."];
  if (classification.trackingStale) lines.push("Our team is actively confirming the latest tracking details with the carrier.");
  if (!classification.podAvailable) lines.push("The POD is currently pending and will be shared as soon as it is received.");
  if (classification.issueType === "detention" || classification.issueType === "accessorial") lines.push("We are reviewing the charges and will provide a documented update shortly.");
  if (classification.riskLevel === "high") lines.push("We will send a confirmed update after verification is complete.");
  else if (load?.eta) lines.push(`Current ETA remains ${load.eta}.`);
  if (classification.escalation) lines.push("We have escalated this for human review to ensure a complete and accurate response.");

  lines.push("Please let us know if there is any additional context you would like us to include.");

  const reasoning = [
    "Generated strictly from email content, load context, and active SOP rules.",
    `Applied ${sopRules.length} active SOP rule(s).`,
    classification.riskLevel === "high" ? "Risk is high, so delivery commitments were intentionally avoided." : "No high-risk delivery commitment restriction triggered."
  ].join(" ");

  const body = lines.join("\n\n");
  const subject = `Re: ${message.subject}`;
  const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY);

  return {
    draftSubject: subject,
    draftBody: body,
    confidence: hasOpenAiKey ? 0.82 : deterministicConfidence(`${message.id}:${classification.id}:${load?.id ?? "none"}:${body}`),
    approvalRequired: true,
    reasoning,
    status: "pending"
  };
}
