export type EmailCategory = "Billing" | "Technical" | "Onboarding" | "Sales" | "Account";
export type Priority = "P1" | "P2" | "P3";
export type RiskLevel = "Low" | "Medium" | "High";

export interface ThreadRecord {
  threadId: string;
  inboundEmails: number;
  classified: boolean;
  draftGenerated: boolean;
  draftApproved: boolean;
  resolved: boolean;
  escalated: boolean;
  confidence: number;
  category: EmailCategory;
  priority: Priority;
  riskLevel: RiskLevel;
  activity: string;
  timestamp: string;
}

// Seeded/demo-style records representative of Neon-backed analytics payloads.
export const neonSeededThreads: ThreadRecord[] = [
  { threadId: "thr_1001", inboundEmails: 2, classified: true, draftGenerated: true, draftApproved: true, resolved: true, escalated: false, confidence: 0.96, category: "Billing", priority: "P2", riskLevel: "Low", activity: "Auto-draft approved and sent", timestamp: "2026-05-25T04:20:00Z" },
  { threadId: "thr_1002", inboundEmails: 1, classified: true, draftGenerated: true, draftApproved: false, resolved: false, escalated: true, confidence: 0.71, category: "Technical", priority: "P1", riskLevel: "High", activity: "Escalated for technical triage", timestamp: "2026-05-25T04:48:00Z" },
  { threadId: "thr_1003", inboundEmails: 3, classified: true, draftGenerated: true, draftApproved: true, resolved: true, escalated: false, confidence: 0.9, category: "Onboarding", priority: "P3", riskLevel: "Low", activity: "Resolved via onboarding playbook", timestamp: "2026-05-25T05:02:00Z" },
  { threadId: "thr_1004", inboundEmails: 2, classified: true, draftGenerated: true, draftApproved: true, resolved: false, escalated: false, confidence: 0.84, category: "Sales", priority: "P2", riskLevel: "Medium", activity: "Draft queued for sales review", timestamp: "2026-05-25T05:11:00Z" },
  { threadId: "thr_1005", inboundEmails: 4, classified: false, draftGenerated: false, draftApproved: false, resolved: false, escalated: true, confidence: 0.55, category: "Account", priority: "P1", riskLevel: "High", activity: "Classification confidence below threshold", timestamp: "2026-05-25T05:39:00Z" }
];
