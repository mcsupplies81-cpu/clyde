import type { Classification, Draft, EmailMessage, Load, SopRule } from "./types.js";

const messages = new Map<string, EmailMessage>();
const classifications = new Map<string, Classification>();
const loads = new Map<string, Load>();
const sopRules: SopRule[] = [];
const aiDrafts: Draft[] = [];

export async function getMessage(messageId: string): Promise<EmailMessage | null> { return messages.get(messageId) ?? null; }
export async function getClassification(classificationId: string): Promise<Classification | null> { return classifications.get(classificationId) ?? null; }
export async function getLoad(loadId: string): Promise<Load | null> { return loads.get(loadId) ?? null; }
export async function getActiveSopRules(tenantId: string, category: string): Promise<SopRule[]> { return sopRules.filter((r) => r.active && r.tenantId === tenantId && r.category === category); }
export async function saveDraft(draft: Draft): Promise<void> { aiDrafts.push(draft); }

// seed helpers for local testing
export function seed() {
  messages.set("m1", { id: "m1", subject: "Need update on shipment", body: "Can you share delivery status and POD?", tenantId: "t1", category: "tracking" });
  classifications.set("c1", { id: "c1", messageId: "m1", category: "tracking", riskLevel: "high", escalation: true, trackingStale: true, podAvailable: false });
  loads.set("l1", { id: "l1", status: "in_transit", carrierName: "ABC Carrier" });
  sopRules.push({ id: "s1", tenantId: "t1", category: "tracking", active: true, text: "Keep updates concise and factual." });
}
