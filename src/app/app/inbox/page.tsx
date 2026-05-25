import Link from "next/link";
import { db } from "@/db";
import {
  emailThreads, emailMessages, loads,
  aiClassifications, aiDrafts, auditLogs, sopRules, loadDocuments,
} from "@/db/schema";
import { eq, desc, and, inArray } from "drizzle-orm";
import { WorkflowBadge } from "@/components/StatusBadge";
import { CategoryBadge } from "@/components/CategoryBadge";
import { deriveWorkflowState, WORKFLOW_LABEL } from "@/lib/workflow";
import { relativeTime } from "@/lib/format";
import { generateResolutionPlan } from "@/lib/resolution";
import {
  ClassifyForm, CopyButton, DraftActions, GenerateDraftForm,
  KeyboardNav, MarkSentForm, ResolveThreadForm, ShortcutHint,
} from "./InboxActions";
import { ResolutionPlan } from "./components/ResolutionPlan";
import { RightContextPanel } from "./components/RightContextPanel";

// ─── Filter types ─────────────────────────────────────────────────────────────

type InboxFilter = "all" | "needs_review" | "ready_to_send" | "sent" | "escalated" | "resolved";

const FILTER_TABS: { label: string; value: InboxFilter | undefined }[] = [
  { label: "All",           value: undefined },
  { label: "Needs Review",  value: "needs_review" },
  { label: "Ready to Send", value: "ready_to_send" },
  { label: "Sent",          value: "sent" },
  { label: "Escalated",     value: "escalated" },
  { label: "Resolved",      value: "resolved" },
];

// ─── Data fetching ────────────────────────────────────────────────────────────

async function getThreadsForFilter(tenantId: string, filter: InboxFilter | undefined) {
  const base = { tenantId: eq(emailThreads.tenantId, tenantId) };

  if (filter === "needs_review") {
    const rows = await db
      .select({ threadId: emailMessages.threadId })
      .from(aiDrafts)
      .innerJoin(emailMessages, eq(aiDrafts.messageId, emailMessages.id))
      .where(and(eq(aiDrafts.tenantId, tenantId), inArray(aiDrafts.status, ["pending", "edited"])));
    const ids = [...new Set(rows.map((r) => r.threadId))];
    return ids.length
      ? db.query.emailThreads.findMany({ where: and(base.tenantId, inArray(emailThreads.id, ids)), orderBy: [desc(emailThreads.lastMessageAt)] })
      : [];
  }

  if (filter === "ready_to_send") {
    const rows = await db
      .select({ threadId: emailMessages.threadId })
      .from(aiDrafts)
      .innerJoin(emailMessages, eq(aiDrafts.messageId, emailMessages.id))
      .where(and(eq(aiDrafts.tenantId, tenantId), eq(aiDrafts.status, "approved")));
    const ids = [...new Set(rows.map((r) => r.threadId))];
    return ids.length
      ? db.query.emailThreads.findMany({ where: and(base.tenantId, inArray(emailThreads.id, ids)), orderBy: [desc(emailThreads.lastMessageAt)] })
      : [];
  }

  if (filter === "sent")      return db.query.emailThreads.findMany({ where: and(base.tenantId, eq(emailThreads.status, "sent")),      orderBy: [desc(emailThreads.lastMessageAt)] });
  if (filter === "escalated") return db.query.emailThreads.findMany({ where: and(base.tenantId, eq(emailThreads.status, "escalated")), orderBy: [desc(emailThreads.lastMessageAt)] });
  if (filter === "resolved")  return db.query.emailThreads.findMany({ where: and(base.tenantId, eq(emailThreads.status, "resolved")),  orderBy: [desc(emailThreads.lastMessageAt)] });

  return db.query.emailThreads.findMany({ where: base.tenantId, orderBy: [desc(emailThreads.lastMessageAt)], limit: 60 });
}

async function getInboxData(tenantId: string, threadId?: string, filter?: InboxFilter) {
  const threads = await getThreadsForFilter(tenantId, filter);
  const threadIds = threads.map((t) => t.id);

  // Batch: first inbound message per thread
  const allFirstMessages = threadIds.length
    ? await db.select().from(emailMessages).where(
        and(eq(emailMessages.tenantId, tenantId), inArray(emailMessages.threadId, threadIds), eq(emailMessages.direction, "inbound")),
      )
    : [];
  const firstMsgByThread: Record<string, typeof allFirstMessages[0]> = {};
  for (const msg of allFirstMessages) {
    if (!firstMsgByThread[msg.threadId]) firstMsgByThread[msg.threadId] = msg;
  }

  // Batch: classifications for thread list
  const firstMsgIds = Object.values(firstMsgByThread).map((m) => m.id);
  const allClassifications = firstMsgIds.length
    ? await db.select().from(aiClassifications).where(inArray(aiClassifications.messageId, firstMsgIds))
    : [];
  const clsByMsg: Record<string, typeof allClassifications[0]> = {};
  for (const c of allClassifications) clsByMsg[c.messageId] = c;

  // Batch: latest draft per first message
  const allDrafts = firstMsgIds.length
    ? await db.select().from(aiDrafts).where(inArray(aiDrafts.messageId, firstMsgIds)).orderBy(desc(aiDrafts.createdAt))
    : [];
  const latestDraftByMsg: Record<string, typeof allDrafts[0]> = {};
  for (const d of allDrafts) {
    if (!latestDraftByMsg[d.messageId]) latestDraftByMsg[d.messageId] = d;
  }

  // Batch: matched loads by load number
  const loadNumbers = allClassifications.map((c) => c.extractedLoadNumber).filter(Boolean) as string[];
  const matchedLoads = loadNumbers.length
    ? await db.select({ id: loads.id, loadNumber: loads.loadNumber }).from(loads).where(
        and(inArray(loads.loadNumber, loadNumbers), eq(loads.tenantId, tenantId)),
      )
    : [];
  const loadByNumber: Record<string, string> = {};
  for (const l of matchedLoads) loadByNumber[l.loadNumber] = l.id;

  // Selected thread detail
  const selectedId = threadId ?? threads[0]?.id;
  if (!selectedId) {
    return {
      threads, firstMsgByThread, clsByMsg, latestDraftByMsg, loadByNumber,
      selectedThread: null, messages: [], classification: null, matchedLoad: null,
      draft: null, timeline: [], appliedSops: [], loadDocs: [], resolutionPlan: null,
    };
  }

  const selectedThread = threads.find((t) => t.id === selectedId) ?? null;
  const messages = selectedThread
    ? await db.query.emailMessages.findMany({ where: eq(emailMessages.threadId, selectedId), orderBy: [desc(emailMessages.receivedAt)] })
    : [];

  const firstInbound = messages.find((m) => m.direction === "inbound");

  // Classification for selected thread
  const allMsgIds = messages.map((m) => m.id);
  const threadClassifications = allMsgIds.length
    ? await db.select().from(aiClassifications).where(inArray(aiClassifications.messageId, allMsgIds)).orderBy(desc(aiClassifications.createdAt))
    : [];
  const classification = threadClassifications[0] ?? null;

  // Matched load
  const matchedLoad = classification?.extractedLoadNumber
    ? (await db.query.loads.findFirst({ where: and(eq(loads.loadNumber, classification.extractedLoadNumber), eq(loads.tenantId, tenantId)) })) ?? null
    : null;

  // Latest draft
  const draft = firstInbound
    ? (await db.query.aiDrafts.findFirst({ where: eq(aiDrafts.messageId, firstInbound.id), orderBy: [desc(aiDrafts.createdAt)] })) ?? null
    : null;

  // Applied SOPs for the classification category
  const appliedSops = classification?.category
    ? await db.select().from(sopRules).where(
        and(eq(sopRules.tenantId, tenantId), eq(sopRules.isActive, true), eq(sopRules.category, classification.category)),
      )
    : [];

  // Load documents
  const loadDocs = matchedLoad
    ? await db.select().from(loadDocuments).where(eq(loadDocuments.loadId, matchedLoad.id))
    : [];

  // Activity timeline
  const draftIds = draft ? [draft.id] : [];
  const classificationIds = threadClassifications.map((c) => c.id);
  const timelineEntityIds = [selectedId, ...allMsgIds, ...draftIds, ...classificationIds].filter(Boolean);

  const auditEntries = timelineEntityIds.length
    ? await db.select().from(auditLogs)
        .where(and(eq(auditLogs.tenantId, tenantId), inArray(auditLogs.entityId, timelineEntityIds)))
        .orderBy(desc(auditLogs.createdAt))
        .limit(30)
    : [];

  const messageEvents = messages
    .filter((m) => m.direction === "inbound")
    .map((m) => ({
      id: `msg_${m.id}`,
      action: "email_received",
      actorType: "system" as const,
      actorName: m.senderName ?? m.senderEmail,
      entityType: "email_message",
      entityId: m.id,
      createdAt: m.receivedAt ?? m.createdAt,
      metadata: null as null | Record<string, unknown>,
    }));

  const auditEvents = auditEntries.map((e) => ({
    id: e.id,
    action: e.action,
    actorType: e.actorType,
    actorName: e.actorName,
    entityType: e.entityType,
    entityId: e.entityId,
    createdAt: e.createdAt,
    metadata: e.metadata ?? null,
  }));

  const timeline = [...messageEvents, ...auditEvents].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  // Resolution plan
  const resolutionPlan = classification
    ? generateResolutionPlan({ category: classification.category, classification, matchedLoad, appliedSops })
    : null;

  return {
    threads, firstMsgByThread, clsByMsg, latestDraftByMsg, loadByNumber,
    selectedThread, messages, classification, matchedLoad, draft,
    timeline, appliedSops, loadDocs, resolutionPlan,
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ threadId?: string; filter?: string }> }) {
  const { threadId, filter: rawFilter } = await searchParams;
  const tenantId = process.env.DEMO_TENANT_ID ?? "";

  if (!tenantId) {
    return (
      <div style={{ padding: 40, color: "#DC2626" }}>
        <strong>DEMO_TENANT_ID not set.</strong> Run <code>npm run db:seed</code>.
      </div>
    );
  }

  const validFilters: InboxFilter[] = ["all", "needs_review", "ready_to_send", "sent", "escalated", "resolved"];
  const filter = validFilters.includes(rawFilter as InboxFilter) ? (rawFilter as InboxFilter) : undefined;

  const {
    threads, firstMsgByThread, clsByMsg, latestDraftByMsg, loadByNumber,
    selectedThread, messages, classification, matchedLoad, draft,
    timeline, appliedSops, loadDocs, resolutionPlan,
  } = await getInboxData(tenantId, threadId, filter);

  const firstInbound = messages.find((m) => m.direction === "inbound");

  const workflowState = selectedThread
    ? deriveWorkflowState({
        threadStatus: selectedThread.status,
        hasClassification: !!classification,
        hasMatchedLoad: !!matchedLoad,
        draftStatus: draft?.status,
      })
    : null;

  const threadIds = threads.map((t) => t.id);

  const priorityColor: Record<string, string> = {
    urgent: "#DC2626", high: "#EA580C", normal: "#2563EB", low: "#9CA3AF",
  };

  // Whether the user explicitly picked a thread in the URL (drives mobile view)
  const hasExplicitThread = !!threadId;

  return (
    <div
      className="inbox-root"
      data-has-thread={hasExplicitThread ? "true" : "false"}
      style={{ display: "flex", height: "100%", overflow: "hidden", background: "#FAFAF8" }}
    >
      <KeyboardNav
        threadIds={threadIds}
        currentId={selectedThread?.id}
        filter={filter}
        canGenerate={workflowState === "classified" || workflowState === "matched"}
        canApprove={workflowState === "awaiting_approval"}
        canMarkSent={workflowState === "approved_ready_to_send"}
        canResolve={workflowState === "sent"}
      />

      {/* ── Left: thread list ── */}
      <div className="inbox-threads" style={{ width: 284, minWidth: 284, borderRight: "1px solid #E8E8E8", display: "flex", flexDirection: "column", overflow: "hidden", background: "#FFFFFF" }}>

        {/* Header + filter tabs */}
        <div style={{ borderBottom: "1px solid #E8E8E8", flexShrink: 0 }}>
          <div style={{ padding: "10px 16px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "1px" }}>
              Work Queue
            </span>
            <span style={{ fontSize: 10, color: "#7F7F7F", background: "#F2F2F2", padding: "2px 8px", borderRadius: 10, fontWeight: 600 }}>
              {threads.length}
            </span>
          </div>
          <div style={{ display: "flex", gap: 0, padding: "0 10px", overflowX: "auto" }}>
            {FILTER_TABS.map(({ label, value }) => {
              const active = filter === value;
              const href = value ? `/app/inbox?filter=${value}` : "/app/inbox";
              return (
                <Link
                  key={label}
                  href={href}
                  style={{
                    padding: "5px 8px",
                    borderRadius: "4px 4px 0 0",
                    fontSize: 11,
                    fontWeight: 600,
                    textDecoration: "none",
                    whiteSpace: "nowrap",
                    color: active ? "#2563EB" : "#9CA3AF",
                    borderBottom: active ? "2px solid #2563EB" : "2px solid transparent",
                  }}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Thread list */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          {threads.length === 0 && (
            <div style={{ padding: "40px 16px", textAlign: "center", color: "#9CA3AF", fontSize: 12 }}>
              No threads in this view
            </div>
          )}
          {threads.map((t) => {
            const active = t.id === selectedThread?.id;
            const firstMsg = firstMsgByThread[t.id];
            const cls = firstMsg ? clsByMsg[firstMsg.id] : null;
            const latestDraft = firstMsg ? latestDraftByMsg[firstMsg.id] : null;
            const hasLoad = cls?.extractedLoadNumber ? !!loadByNumber[cls.extractedLoadNumber] : false;
            const wState = deriveWorkflowState({
              threadStatus: t.status,
              hasClassification: !!cls,
              hasMatchedLoad: hasLoad,
              draftStatus: latestDraft?.status,
            });
            const pColor = priorityColor[t.priority] ?? "#9CA3AF";
            const filterParam = filter ? `&filter=${filter}` : "";

            return (
              <Link key={t.id} href={`/app/inbox?threadId=${t.id}${filterParam}`} style={{ display: "block", textDecoration: "none" }}>
                <div style={{
                  padding: "10px 14px",
                  borderBottom: "1px solid #F2F2F2",
                  background: active ? "#EFF6FF" : "transparent",
                  borderLeft: `3px solid ${active ? "#2563EB" : "transparent"}`,
                }}>
                  {/* Subject */}
                  <div style={{
                    fontSize: 12, fontWeight: active ? 600 : 500,
                    color: active ? "#1D4ED8" : "#5D5D5D",
                    lineHeight: 1.4, marginBottom: 4,
                    overflow: "hidden", display: "-webkit-box",
                    WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const,
                  }}>
                    {t.subject}
                  </div>

                  {/* Company + time */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: "#7F7F7F" }}>{t.customerName ?? t.carrierName ?? "—"}</span>
                    <span style={{ fontSize: 10, color: "#9CA3AF", whiteSpace: "nowrap" }}>{relativeTime(t.lastMessageAt)}</span>
                  </div>

                  {/* Badges */}
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" as const }}>
                    <WorkflowBadge state={wState} />
                    {cls && <CategoryBadge category={cls.category} />}
                    {t.priority === "urgent" && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: pColor, background: `${pColor}18`, padding: "1px 5px", borderRadius: 3, textTransform: "uppercase", letterSpacing: "0.3px" }}>
                        {t.priority}
                      </span>
                    )}
                    {cls?.extractedLoadNumber && (
                      <span style={{ fontSize: 10, color: "#9CA3AF", fontFamily: "monospace" }}>
                        #{cls.extractedLoadNumber}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Keyboard shortcuts hint */}
        <div style={{ padding: "8px 14px", borderTop: "1px solid #F2F2F2", flexShrink: 0, background: "#FAFAF8" }}>
          <ShortcutHint />
        </div>
      </div>

      {/* ── Center: thread view ── */}
      <div className="inbox-center" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0, background: "#FAFAF8" }}>
        {selectedThread ? (
          <>
            {/* Thread header */}
            <div style={{ padding: "12px 20px", borderBottom: "1px solid #E8E8E8", flexShrink: 0, background: "#FFFFFF" }}>
              {/* Mobile back button */}
              <Link
                href={filter ? `/app/inbox?filter=${filter}` : "/app/inbox"}
                className="inbox-back-btn"
                style={{
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  color: "#2563EB",
                  textDecoration: "none",
                  fontWeight: 600,
                  marginBottom: 8,
                }}
              >
                ← Back to inbox
              </Link>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <h2 style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700, color: "#292929", lineHeight: 1.35 }}>
                  {selectedThread.subject}
                </h2>
                {workflowState && (
                  <div style={{ fontSize: 11, color: "#9CA3AF", whiteSpace: "nowrap", paddingTop: 2 }}>
                    {WORKFLOW_LABEL[workflowState]}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" as const }}>
                {workflowState && <WorkflowBadge state={workflowState} />}
                {classification && <CategoryBadge category={classification.category} />}
                {classification?.urgency && !["normal", "low"].includes(classification.urgency) && (
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    color: classification.urgency === "critical" ? "#DC2626" : "#EA580C",
                    background: classification.urgency === "critical" ? "#FEF2F2" : "#FFF7ED",
                    padding: "2px 7px", borderRadius: 4,
                  }}>
                    {classification.urgency.toUpperCase()}
                  </span>
                )}
                {matchedLoad && (
                  <Link
                    href={`/app/loads/${matchedLoad.id}`}
                    style={{ fontSize: 11, color: "#2563EB", background: "#EFF6FF", border: "1px solid #BFDBFE", padding: "2px 8px", borderRadius: 4, textDecoration: "none", fontWeight: 600 }}
                  >
                    {matchedLoad.loadNumber} →
                  </Link>
                )}
              </div>
            </div>

            {/* Messages + plan + draft */}
            <div style={{ flex: 1, overflow: "auto", padding: "16px 20px" }}>
              <div style={{ maxWidth: 800 }}>

                {/* Messages */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                  {messages.map((msg) => {
                    const isInbound = msg.direction === "inbound";
                    return (
                      <div
                        key={msg.id}
                        style={{
                          background: "#FFFFFF",
                          border: `1px solid ${isInbound ? "#E8E8E8" : "#D1FAE5"}`,
                          borderRadius: 8,
                          overflow: "hidden",
                        }}
                      >
                        {/* Message header */}
                        <div style={{
                          padding: "9px 14px",
                          borderBottom: `1px solid ${isInbound ? "#F2F2F2" : "#ECFDF5"}`,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          background: isInbound ? "#FAFAF8" : "#F0FDF4",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                            <div style={{
                              width: 28, height: 28, borderRadius: 8,
                              background: isInbound ? "#EFF6FF" : "#DCFCE7",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 11, fontWeight: 700,
                              color: isInbound ? "#2563EB" : "#16A34A",
                              flexShrink: 0,
                            }}>
                              {(msg.senderName ?? msg.senderEmail)[0]?.toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: "#292929" }}>{msg.senderName ?? msg.senderEmail}</div>
                              <div style={{ fontSize: 10, color: "#9CA3AF" }}>{msg.senderEmail}</div>
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontSize: 10, fontWeight: 600, color: isInbound ? "#2563EB" : "#16A34A", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                              {isInbound ? "↓ Inbound" : "↑ Outbound"}
                            </span>
                            <span style={{ fontSize: 10, color: "#9CA3AF" }}>{relativeTime(msg.receivedAt)}</span>
                          </div>
                        </div>

                        {/* Body */}
                        <div style={{ padding: "12px 14px" }}>
                          <p style={{ margin: 0, color: "#5D5D5D", fontSize: 13, lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{msg.body}</p>
                        </div>

                        {/* Classify button on inbound */}
                        {isInbound && (
                          <div style={{ padding: "0 14px 10px" }}>
                            <ClassifyForm
                              message={msg}
                              hasClassification={!!classification}
                              threadId={selectedThread.id}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* ── Clyde's Plan ── */}
                {resolutionPlan && (
                  <ResolutionPlan plan={resolutionPlan} />
                )}

                {/* Draft section */}
                {draft && (
                  <div style={{
                    marginBottom: 20,
                    background:
                      draft.status === "approved" || draft.status === "edited" ? "#F0FDF4"
                      : draft.status === "rejected" ? "#FEF2F2"
                      : "#EFF6FF",
                    border: `1px solid ${
                      draft.status === "approved" || draft.status === "edited" ? "#D1FAE5"
                      : draft.status === "rejected" ? "#FECACA"
                      : "#BFDBFE"
                    }`,
                    borderRadius: 8,
                    overflow: "hidden",
                  }}>
                    <div style={{
                      padding: "10px 14px",
                      borderBottom: `1px solid ${
                        draft.status === "approved" || draft.status === "edited" ? "#D1FAE5"
                        : draft.status === "rejected" ? "#FECACA"
                        : "#BFDBFE"
                      }`,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      background:
                        draft.status === "approved" || draft.status === "edited" ? "#ECFDF5"
                        : draft.status === "rejected" ? "#FEF2F2"
                        : "#EFF6FF",
                    }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, letterSpacing: "0.3px",
                        color:
                          draft.status === "approved" || draft.status === "edited" ? "#15803D"
                          : draft.status === "rejected" ? "#DC2626"
                          : "#2563EB",
                      }}>
                        {draft.status === "approved" ? "✓ Draft Approved — Human Send Required"
                         : draft.status === "edited"   ? "✎ Edited — Awaiting Approval"
                         : draft.status === "rejected" ? "✕ Draft Rejected"
                         : "⊙ Clyde's Suggested Reply — Awaiting Your Approval"}
                      </span>
                      <span style={{ fontSize: 10, color: "#9CA3AF" }}>
                        {Math.round(Number(draft.confidence) * 100)}% confidence
                      </span>
                    </div>
                    <div style={{ padding: "12px 14px" }}>
                      {draft.draftSubject && (
                        <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 6 }}>
                          Subject: <span style={{ color: "#5D5D5D" }}>{draft.draftSubject}</span>
                        </div>
                      )}
                      <p style={{ margin: "0 0 14px", color: "#292929", fontSize: 13, lineHeight: 1.75, whiteSpace: "pre-wrap" }}>
                        {draft.draftBody}
                      </p>

                      {(draft.status === "pending" || draft.status === "edited") && (
                        <DraftActions
                          draftId={draft.id}
                          threadId={selectedThread.id}
                          draftBody={draft.draftBody}
                        />
                      )}

                      {draft.status === "approved" && workflowState === "approved_ready_to_send" && (
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" as const }}>
                          <CopyButton text={draft.draftBody} />
                          <span style={{ fontSize: 11, color: "#7F7F7F" }}>Copy, paste into your email client, then mark as sent below.</span>
                        </div>
                      )}

                      {draft.status === "rejected" && (
                        <div style={{ fontSize: 12, color: "#9CA3AF" }}>Generate a new draft below.</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Mark Sent CTA */}
                {workflowState === "approved_ready_to_send" && selectedThread && (
                  <div style={{ marginBottom: 20, padding: "14px 16px", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#1D4ED8", marginBottom: 6 }}>
                      Human Approval Required
                    </div>
                    <div style={{ fontSize: 12, color: "#5D5D5D", marginBottom: 12 }}>
                      Copy the reply above, send it from your email client, then mark it here.
                    </div>
                    <MarkSentForm threadId={selectedThread.id} />
                  </div>
                )}

                {/* Resolve CTA */}
                {workflowState === "sent" && selectedThread && (
                  <div style={{ marginBottom: 20, padding: "14px 16px", background: "#F0FDF4", border: "1px solid #D1FAE5", borderRadius: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#15803D", marginBottom: 6 }}>
                      Sent Manually — Activity Logged
                    </div>
                    <div style={{ fontSize: 12, color: "#5D5D5D", marginBottom: 12 }}>
                      Reply was sent from your email client. Resolve this thread when the issue is fully handled.
                    </div>
                    <ResolveThreadForm threadId={selectedThread.id} />
                  </div>
                )}

                {/* Generate draft CTA */}
                {firstInbound && (!draft || draft.status === "rejected") && (
                  <div style={{ marginBottom: 20 }}>
                    <GenerateDraftForm
                      messageId={firstInbound.id}
                      classificationId={classification?.id}
                      loadId={matchedLoad?.id}
                      threadId={selectedThread.id}
                    />
                  </div>
                )}

              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF", fontSize: 13 }}>
            Select a thread to begin
          </div>
        )}
      </div>

      {/* ── Right: context panel ── */}
      <div className="inbox-right" style={{ width: 296, minWidth: 296, borderLeft: "1px solid #E8E8E8", display: "flex", flexDirection: "column", overflow: "hidden", background: "#FFFFFF" }}>
        {selectedThread ? (
          <RightContextPanel
            matchedLoad={matchedLoad}
            classification={classification}
            appliedSops={appliedSops}
            loadDocs={loadDocs}
            timeline={timeline}
            threadId={selectedThread.id}
            currentStatus={selectedThread.status}
          />
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF", fontSize: 12, padding: 20, textAlign: "center" }}>
            Select a thread to see load context
          </div>
        )}
      </div>
    </div>
  );
}
