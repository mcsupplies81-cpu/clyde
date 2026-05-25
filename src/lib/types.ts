export type EmailMessage = { id: string; subject: string; body: string; tenantId: string; category: string };
export type Classification = { id: string; messageId: string; category: string; riskLevel: "low" | "medium" | "high"; escalation: boolean; trackingStale: boolean; podAvailable: boolean; issueType?: "detention" | "accessorial" | "general" };
export type Load = { id: string; status: string; eta?: string; carrierName?: string };
export type SopRule = { id: string; tenantId: string; category: string; active: boolean; text: string };
export type Draft = { draftSubject: string; draftBody: string; confidence: number; approvalRequired: true; reasoning: string; status: "pending" };
