export const NEVER_AUTO_SEND = new Set([
  "detention_accessorial",
  "billing_invoice",
  "escalation",
  "unknown",
  "quote_request",
  "claims",
]);

export const ALWAYS_REQUIRE_HUMAN_APPROVAL = new Set([
  "detention_accessorial",
  "billing_invoice",
  "escalation",
  "quote_request",
]);

export const SAFE_TO_AUTO_DRAFT = new Set([
  "status_request",
  "carrier_update",
  "bol_request",
  "pod_request",
  "rate_confirmation",
  "appointment_change",
]);

export function canAutoSend(category: string, matchConfidence: number, isFollowUp: boolean): boolean {
  if (NEVER_AUTO_SEND.has(category)) return false;
  if (matchConfidence < 0.75) return false;
  if (isFollowUp) return false;
  return true;
}

export function requiresHumanApproval(category: string): boolean {
  return ALWAYS_REQUIRE_HUMAN_APPROVAL.has(category);
}
