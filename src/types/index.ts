export type ThreadStatus = "open" | "pending_review" | "drafted" | "sent" | "resolved" | "escalated";
export type ThreadPriority = "low" | "normal" | "high" | "urgent";
export type DraftStatus = "pending" | "approved" | "rejected" | "edited";
export type RiskLevel = "low" | "medium" | "high" | "critical";
export type ActorType = "user" | "ai" | "system";

export type { WorkflowState } from "@/lib/workflow";
