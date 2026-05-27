"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { WorkflowBadge } from "@/components/StatusBadge";
import { CategoryBadge } from "@/components/CategoryBadge";
import { deriveWorkflowState, WORKFLOW_LABEL } from "@/lib/workflow";
import { relativeTime } from "@/lib/format";
import {
  ClassifyForm, CopyButton, DraftActions, GenerateDraftForm,
  MarkSentForm, ResolveThreadForm, ShortcutHint,
} from "./InboxActions";
import { RightContextPanel } from "./components/RightContextPanel";
import { LoadContextCard } from "./components/LoadContextCard";
import { DOC_ICON, DOC_COLOR } from "@/lib/document-classifier";
import type { DocumentType } from "@/lib/document-classifier";
import { SyncButton } from "./SyncButton";
import type { ThreadDetail } from "@/lib/inbox-thread-detail";

// ── Client-side prefetch cache ─────────────────────────────────────────────────
const _detailCache = new Map<string, ThreadDetail>();
const _pendingFetch = new Map<string, Promise<ThreadDetail>>();

function prefetchThreadDetail(threadId: string): Promise<ThreadDetail> {
  if (_detailCache.has(threadId)) return Promise.resolve(_detailCache.get(threadId)!);
  if (_pendingFetch.has(threadId)) return _pendingFetch.get(threadId)!;
  const p = fetch(`/api/inbox/thread?threadId=${threadId}`)
    .then((r) => r.json() as Promise<ThreadDetail>)
    .then((d) => { _detailCache.set(threadId, d); _pendingFetch.delete(threadId); return d; })
    .catch((e) => { _pendingFetch.delete(threadId); throw e; });
  _pendingFetch.set(threadId, p);
  return p;
}

// ── Types ──────────────────────────────────────────────────────────────────────

type Thread = {
  id: string;
  subject: string;
  customerName: string | null;
  carrierName: string | null;
  status: string;
  priority: string;
  gmailThreadId: string | null;
  lastMessageAt: Date | string | null;
};

type FirstMsg = { id: string; threadId: string; senderName: string | null; senderEmail: string; direction: string };
type Classification = { messageId: string; category: string; extractedLoadNumber: string | null; urgency: string | null; [key: string]: unknown };
type LatestDraft = { messageId: string; status: string; [key: string]: unknown };

type InboxRootProps = {
  threads: Thread[];
  firstMsgByThread: Record<string, FirstMsg>;
  clsByMsg: Record<string, Classification>;
  latestDraftByMsg: Record<string, LatestDraft>;
  loadByNumber: Record<string, string>;
  initialSelectedId: string | null;
  initialDetail: ThreadDetail | null;
  connection: { lastSyncAt: Date | string | null } | null;
  filter: string | undefined;
};

// Primary filters shown as large tabs (Superhuman-style)
const PRIMARY_TABS = [
  { label: "All",           value: undefined },
  { label: "Needs Review",  value: "needs_review" },
  { label: "Ready to Send", value: "ready_to_send" },
  { label: "Done",          value: "resolved" },
];

// Secondary filters shown below, smaller
const SECONDARY_TABS = [
  { label: "Sent",           value: "sent" },
  { label: "Escalated",      value: "escalated" },
  { label: "Quotes",         value: "quote_request" },
  { label: "Status Updates", value: "status_request" },
  { label: "Needs POD",      value: "pod_request" },
  { label: "Needs BOL",      value: "bol_request" },
  { label: "Appt Changes",   value: "appointment_change" },
];

const FILTER_TABS = [...PRIMARY_TABS, ...SECONDARY_TABS];

const PRIORITY_COLOR: Record<string, string> = {
  urgent: "#DC2626", high: "#EA580C", normal: "#2563EB", low: "#9CA3AF",
};

// Status dot shown in thread list items
const STATUS_DOT: Record<string, string> = {
  open: "#D1D5DB",
  pending_review: "#F59E0B",
  drafted: "#60A5FA",
  approved_ready_to_send: "#16A34A",
  sent: "#16A34A",
  resolved: "#D1D5DB",
  escalated: "#DC2626",
};

// ── Main component ─────────────────────────────────────────────────────────────

export function InboxRoot({
  threads,
  firstMsgByThread,
  clsByMsg,
  latestDraftByMsg,
  loadByNumber,
  initialSelectedId,
  initialDetail,
  connection,
  filter,
}: InboxRootProps) {
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [detail, setDetail] = useState<ThreadDetail | null>(initialDetail);
  const [isLoading, setIsLoading] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Keep a ref so effects can read the latest selectedId without stale closures
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  // Seed the module-level cache with SSR data
  if (initialSelectedId && initialDetail && !_detailCache.has(initialSelectedId)) {
    _detailCache.set(initialSelectedId, initialDetail);
  }

  // After server actions (generate draft, approve, etc.) Next.js streams fresh
  // initialDetail props. useState ignores prop changes after first render — sync here.
  // Also handles URL-driven navigation (e.g. clicking a result in the search modal).
  useEffect(() => {
    if (!initialDetail || !initialSelectedId) return;
    _detailCache.set(initialSelectedId, initialDetail);
    setDetail(initialDetail);
    // Sync selection when navigating via URL (search, direct link, etc.)
    if (initialSelectedId !== selectedIdRef.current) {
      setSelectedId(initialSelectedId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDetail, initialSelectedId]);

  const selectedThread = threads.find((t) => t.id === selectedId) ?? null;

  const selectThread = useCallback(async (threadId: string) => {
    if (threadId === selectedId) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setSelectedId(threadId);
    setIsLoading(true);
    const filterParam = filter ? `&filter=${filter}` : "";
    window.history.pushState(null, "", `/app/inbox?threadId=${threadId}${filterParam}`);
    try {
      const newDetail = await prefetchThreadDetail(threadId);
      setDetail(newDetail);
    } catch (err) {
      if ((err as Error).name !== "AbortError") console.error("thread fetch error", err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedId, filter]);

  // Background prefetch next 6 threads after mount
  const threadIds = threads.map((t) => t.id);
  useEffect(() => {
    const toPreload = threadIds.filter((id) => id !== initialSelectedId).slice(0, 6);
    let cancelled = false;
    (async () => {
      for (const id of toPreload) {
        if (cancelled) break;
        prefetchThreadDetail(id).catch(() => {});
        await new Promise((r) => setTimeout(r, 400));
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Search modal → select thread instantly without a server round-trip
  useEffect(() => {
    function onSelectThread(e: Event) {
      const { threadId } = (e as CustomEvent<{ threadId: string }>).detail;
      if (threadId) selectThread(threadId);
    }
    window.addEventListener("clyde:select-thread", onSelectThread);
    return () => window.removeEventListener("clyde:select-thread", onSelectThread);
  }, [selectThread]);

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      const idx = threadIds.indexOf(selectedId ?? "");
      switch (e.key) {
        case "j": case "ArrowDown": { e.preventDefault(); const next = threadIds[idx + 1]; if (next) selectThread(next); break; }
        case "k": case "ArrowUp":   { e.preventDefault(); const prev = threadIds[idx - 1]; if (prev) selectThread(prev); break; }
        case "g": (document.querySelector("[data-shortcut='generate']") as HTMLButtonElement)?.click(); break;
        case "a": (document.querySelector("[data-shortcut='approve']") as HTMLButtonElement)?.click(); break;
        case "s": (document.querySelector("[data-shortcut='mark-sent']") as HTMLButtonElement)?.click(); break;
        case "r": (document.querySelector("[data-shortcut='resolve']") as HTMLButtonElement)?.click(); break;
        case "\\": setRightOpen(o => !o); break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [threadIds, selectedId, selectThread]);

  // Derive workflow state
  const workflowState = selectedThread && detail
    ? deriveWorkflowState({
        threadStatus: selectedThread.status as Parameters<typeof deriveWorkflowState>[0]["threadStatus"],
        hasClassification: !!detail.classification,
        hasMatchedLoad: !!detail.matchedLoad,
        draftStatus: detail.draft?.status as Parameters<typeof deriveWorkflowState>[0]["draftStatus"],
      })
    : null;

  const firstInbound = detail?.messages.find((m) => m.direction === "inbound");
  const hasDraft = !!detail?.draft;
  const draftSentOrRejected = detail?.draft?.status === "sent" || detail?.draft?.status === "rejected";

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      className="inbox-root"
      data-inbox-root="true"
      data-has-thread={selectedId ? "true" : "false"}
      style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "#F8F8F7" }}
    >

      {/* ── Full-width top nav — Superhuman style ───────────────────────── */}
      <div style={{
        background: "#FFFFFF",
        borderBottom: "1px solid #EBEBEB",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        padding: "0 12px 0 8px",
        gap: 0,
        height: 44,
        overflowX: "auto",
      }}>
        {/* Mobile hamburger — hidden on desktop via CSS */}
        <button
          className="mobile-menu-btn"
          onClick={() => window.dispatchEvent(new CustomEvent("clyde:toggle-mobile-sidebar"))}
          style={{ padding: "8px 10px 8px 4px", background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", flexShrink: 0 }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        {/* Primary tabs: All · Needs Review · Ready to Send · Done */}
        {PRIMARY_TABS.map(({ label, value }, i) => {
          const active = filter === value;
          const href = value ? `/app/inbox?filter=${value}` : "/app/inbox";
          return (
            <span key={label} style={{ display: "flex", alignItems: "center" }}>
              {i > 0 && (
                <span style={{ color: "#D1D5DB", fontSize: 15, margin: "0 4px", userSelect: "none", lineHeight: 1 }}>·</span>
              )}
              <Link
                href={href}
                style={{
                  padding: "4px 6px",
                  fontSize: 15,
                  fontWeight: active ? 700 : 400,
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  color: active ? "#111827" : "#9CA3AF",
                  borderBottom: active ? "2px solid #111827" : "2px solid transparent",
                  lineHeight: "36px",
                }}
              >
                {label}
                {active && threads.length > 0 && (
                  <span style={{ fontSize: 13, fontWeight: 400, color: "#9CA3AF", marginLeft: 5 }}>
                    {threads.length}
                  </span>
                )}
              </Link>
            </span>
          );
        })}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Secondary filters as smaller chips — hidden on mobile */}
        <div className="inbox-secondary-tabs" style={{ display: "flex", gap: 2, alignItems: "center", overflowX: "auto" }}>
          {SECONDARY_TABS.map(({ label, value }) => {
            const active = filter === value;
            const href = value ? `/app/inbox?filter=${value}` : "/app/inbox";
            return (
              <Link
                key={label}
                href={href}
                style={{
                  padding: "3px 9px",
                  fontSize: 11,
                  fontWeight: active ? 600 : 400,
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  color: active ? "#1D4ED8" : "#B0B0B0",
                  background: active ? "#EFF6FF" : "transparent",
                  border: active ? "1px solid #BFDBFE" : "1px solid transparent",
                  borderRadius: 20,
                }}
              >
                {label}
              </Link>
            );
          })}
          {connection && <SyncButton />}
        </div>
      </div>

      {/* ── Content row ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

      {/* ── Left: thread list ───────────────────────────────────────────── */}
      <div className="inbox-threads" style={{ width: 300, minWidth: 300, borderRight: "1px solid #EBEBEB", display: "flex", flexDirection: "column", overflow: "hidden", background: "#FFFFFF" }}>

        {/* Thread list header — now just count */}
        <div style={{ padding: "10px 14px 8px", borderBottom: "1px solid #F0F0F0", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.6px" }}>
            {filter ? ([...SECONDARY_TABS, ...PRIMARY_TABS] as { label: string; value: string | undefined }[]).find(t => t.value === filter)?.label ?? "All" : "All"}
          </span>
          <span style={{ fontSize: 11, color: "#C4C4C4" }}>{threads.length}</span>
        </div>


        {/* Thread list */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          {threads.length === 0 && (
            <div style={{ padding: "48px 16px", textAlign: "center", color: "#C4C4C4", fontSize: 12 }}>
              No threads here
            </div>
          )}
          {threads.map((t) => {
            const active = t.id === selectedId;
            const firstMsg = firstMsgByThread[t.id];
            const cls = firstMsg ? clsByMsg[firstMsg.id] : null;
            const latestDraft = firstMsg ? latestDraftByMsg[firstMsg.id] : null;
            const hasLoad = cls?.extractedLoadNumber ? !!loadByNumber[cls.extractedLoadNumber] : false;
            const wState = deriveWorkflowState({
              threadStatus: t.status as Parameters<typeof deriveWorkflowState>[0]["threadStatus"],
              hasClassification: !!cls,
              hasMatchedLoad: hasLoad,
              draftStatus: latestDraft?.status as Parameters<typeof deriveWorkflowState>[0]["draftStatus"],
            });
            const dotColor = STATUS_DOT[wState] ?? STATUS_DOT[t.status] ?? "#D1D5DB";
            const isUrgent = t.priority === "urgent";
            const isUnread = ["open", "pending_review"].includes(t.status);
            const sender = t.customerName ?? t.carrierName ?? "—";

            return (
              <button
                key={t.id}
                onClick={() => selectThread(t.id)}
                onMouseEnter={() => prefetchThreadDetail(t.id)}
                style={{ display: "block", width: "100%", textAlign: "left", border: "none", padding: 0, background: "none", cursor: "pointer" }}
              >
                <div style={{
                  padding: "9px 12px 9px 10px",
                  borderBottom: "1px solid #F4F4F4",
                  background: active ? "#EFF6FF" : "transparent",
                  borderLeft: `3px solid ${active ? "#2563EB" : isUrgent ? PRIORITY_COLOR.urgent : "transparent"}`,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}>
                  {/* Unread dot */}
                  <div style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: isUnread && !active ? dotColor : "transparent",
                    flexShrink: 0,
                  }} />

                  {/* Main content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Single row: sender · subject · time */}
                    <div style={{ display: "flex", alignItems: "baseline", gap: 0 }}>
                      {/* Sender */}
                      <span style={{
                        fontSize: 12,
                        fontWeight: isUnread || active ? 700 : 400,
                        color: active ? "#1D4ED8" : isUnread ? "#111827" : "#6B7280",
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                        maxWidth: 110,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}>
                        {sender}
                      </span>

                      {/* Separator */}
                      <span style={{ color: "#D1D5DB", fontSize: 11, margin: "0 5px", flexShrink: 0 }}>·</span>

                      {/* Subject */}
                      <span style={{
                        fontSize: 12,
                        fontWeight: isUnread || active ? 500 : 400,
                        color: active ? "#2563EB" : isUnread ? "#374151" : "#9CA3AF",
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}>
                        {t.subject}
                        {cls?.extractedLoadNumber && (
                          <span style={{ color: "#93C5FD", marginLeft: 5, fontFamily: "monospace", fontSize: 11 }}>
                            #{cls.extractedLoadNumber}
                          </span>
                        )}
                      </span>

                      {/* Time */}
                      <span style={{
                        fontSize: 10,
                        color: isUnread && !active ? "#6B7280" : "#C4C4C4",
                        fontWeight: isUnread && !active ? 500 : 400,
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                        marginLeft: 6,
                      }}>
                        {relativeTime(t.lastMessageAt)}
                      </span>
                    </div>

                    {/* Category badge — only if classified */}
                    {cls && (
                      <div style={{ marginTop: 3 }}>
                        <CategoryBadge category={cls.category} />
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div style={{ padding: "8px 12px", borderTop: "1px solid #F5F5F5", flexShrink: 0 }}>
          <ShortcutHint />
        </div>
      </div>

      {/* ── Center: email view ──────────────────────────────────────────── */}
      <div className="inbox-center" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0, background: "#FAFAF8", position: "relative" }}>

        {/* Loading overlay */}
        {isLoading && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(250,250,248,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10 }}>
            <div style={{ fontSize: 12, color: "#B0B0B0" }}>Loading…</div>
          </div>
        )}

        {selectedThread && detail ? (
          <>
            {/* Thread header */}
            <div style={{ padding: "12px 20px", borderBottom: "1px solid #EBEBEB", flexShrink: 0, background: "#FFFFFF" }}>
              {/* Back button — mobile only */}
              <button
                className="inbox-back-btn"
                onClick={() => setSelectedId(null)}
                style={{
                  alignItems: "center", gap: 5, marginBottom: 10,
                  background: "none", border: "none", cursor: "pointer",
                  color: "#2563EB", fontSize: 13, fontWeight: 500, padding: 0,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                Back
              </button>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <h2 style={{ margin: "0 0 5px", fontSize: 14, fontWeight: 700, color: "#1A1A1A", lineHeight: 1.35, flex: 1 }}>
                  {selectedThread.subject}
                </h2>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                  {workflowState && (
                    <span style={{ fontSize: 11, color: "#9CA3AF" }}>{WORKFLOW_LABEL[workflowState]}</span>
                  )}
                  {/* Context panel toggle — keyboard shortcut \ */}
                  <button
                    type="button"
                    onClick={() => setRightOpen(o => !o)}
                    title={`${rightOpen ? "Hide" : "Show"} context  (\\)`}
                    style={{
                      padding: "4px 9px",
                      background: rightOpen ? "#EFF6FF" : "#F5F5F5",
                      border: `1px solid ${rightOpen ? "#BFDBFE" : "#E8E8E8"}`,
                      borderRadius: 5,
                      fontSize: 11,
                      color: rightOpen ? "#2563EB" : "#9CA3AF",
                      cursor: "pointer",
                      fontWeight: 500,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {rightOpen ? "Hide info" : "Show info"}
                  </button>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" as const }}>
                {workflowState && <WorkflowBadge state={workflowState} />}
                {detail.classification && <CategoryBadge category={detail.classification.category} />}
                {detail.classification?.urgency && !["normal", "low"].includes(detail.classification.urgency) && (
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    color: detail.classification.urgency === "critical" ? "#DC2626" : "#EA580C",
                    background: detail.classification.urgency === "critical" ? "#FEF2F2" : "#FFF7ED",
                    padding: "2px 7px", borderRadius: 4,
                  }}>
                    {detail.classification.urgency.toUpperCase()}
                  </span>
                )}
                {detail.matchedLoad && (
                  <Link
                    href={`/app/loads/${detail.matchedLoad.id}`}
                    style={{ fontSize: 11, color: "#2563EB", background: "#EFF6FF", border: "1px solid #BFDBFE", padding: "2px 8px", borderRadius: 4, textDecoration: "none", fontWeight: 600 }}
                  >
                    {detail.matchedLoad.loadNumber} →
                  </Link>
                )}
              </div>
            </div>

            {/* Conversation + draft */}
            <div style={{ flex: 1, overflow: "auto", padding: "16px 20px" }}>
              <div style={{ maxWidth: 760 }}>

                {/* Load context card — shows when AI matched a load */}
                <LoadContextCard
                  matchedLoad={detail.matchedLoad}
                  classification={detail.classification}
                  docCount={detail.loadDocs.length}
                />

                {/* Messages */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                  {detail.messages.map((msg) => {
                    const isInbound = msg.direction === "inbound";
                    return (
                      <div key={msg.id} style={{
                        background: "#FFFFFF",
                        border: `1px solid ${isInbound ? "#EBEBEB" : "#D1FAE5"}`,
                        borderRadius: 8,
                        overflow: "hidden",
                      }}>
                        <div style={{
                          padding: "8px 14px",
                          background: isInbound ? "#FAFAF8" : "#F0FDF4",
                          borderBottom: `1px solid ${isInbound ? "#F2F2F2" : "#ECFDF5"}`,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{
                              width: 26, height: 26, borderRadius: 7,
                              background: isInbound ? "#EFF6FF" : "#DCFCE7",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 11, fontWeight: 700,
                              color: isInbound ? "#2563EB" : "#16A34A",
                              flexShrink: 0,
                            }}>
                              {(msg.senderName ?? msg.senderEmail)[0]?.toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: "#1A1A1A" }}>
                                {msg.senderName ?? msg.senderEmail}
                              </div>
                              <div style={{ fontSize: 10, color: "#B0B0B0" }}>{msg.senderEmail}</div>
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontSize: 10, color: isInbound ? "#2563EB" : "#16A34A", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.3px" }}>
                              {isInbound ? "↓ Received" : "↑ Sent"}
                            </span>
                            <span style={{ fontSize: 10, color: "#B0B0B0" }}>{relativeTime(msg.receivedAt)}</span>
                          </div>
                        </div>
                        <div style={{ padding: "12px 14px" }}>
                          <p style={{ margin: 0, color: "#3D3D3D", fontSize: 13, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{msg.body}</p>
                        </div>

                        {/* Attachment strip */}
                        {(() => {
                          const atts = detail.attachmentsByMessage?.[msg.id] ?? [];
                          if (!atts.length) return null;
                          return (
                            <div style={{ padding: "0 14px 12px", display: "flex", flexWrap: "wrap", gap: 6 }}>
                              {atts.map((att) => {
                                const docType = att.documentType as DocumentType;
                                const colors = DOC_COLOR[docType] ?? DOC_COLOR["Other"];
                                const icon = DOC_ICON[docType] ?? "📎";
                                const inner = (
                                  <span style={{
                                    display: "inline-flex", alignItems: "center", gap: 5,
                                    background: colors.bg, color: colors.text,
                                    border: `1px solid ${colors.border}`,
                                    fontSize: 11, fontWeight: 600,
                                    padding: "3px 9px", borderRadius: 5,
                                    textDecoration: "none",
                                    cursor: att.fileUrl ? "pointer" : "default",
                                  }}>
                                    <span>{icon}</span>
                                    <span>{docType}</span>
                                    <span style={{ fontWeight: 400, color: colors.text, opacity: 0.7 }}>
                                      {att.fileName.length > 24 ? att.fileName.slice(0, 22) + "…" : att.fileName}
                                    </span>
                                    {att.fileSizeBytes && (
                                      <span style={{ fontWeight: 400, opacity: 0.5 }}>
                                        {att.fileSizeBytes > 1024 * 1024
                                          ? `${(att.fileSizeBytes / 1024 / 1024).toFixed(1)}MB`
                                          : `${Math.round(att.fileSizeBytes / 1024)}KB`}
                                      </span>
                                    )}
                                  </span>
                                );
                                return att.fileUrl ? (
                                  <a key={att.id} href={att.fileUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                                    {inner}
                                  </a>
                                ) : (
                                  <span key={att.id}>{inner}</span>
                                );
                              })}
                            </div>
                          );
                        })()}

                        {isInbound && (
                          <div style={{ padding: "0 14px 10px" }}>
                            <ClassifyForm
                              message={msg as Parameters<typeof ClassifyForm>[0]["message"]}
                              hasClassification={!!detail.classification}
                              threadId={selectedThread.id}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* ── Inline AI draft ─────────────────────────────────────── */}
                {hasDraft && !draftSentOrRejected && (() => {
                  const d = detail.draft!;
                  const isApproved = d.status === "approved" || d.status === "edited";
                  const borderColor = isApproved ? "#86EFAC" : "#93C5FD";
                  const headerBg   = isApproved ? "#ECFDF5" : "#EFF6FF";
                  const cardBg     = isApproved ? "#F0FDF4" : "#F8FAFF";
                  const textColor  = isApproved ? "#15803D" : "#2563EB";
                  const label =
                    d.status === "approved" ? "✓ Draft approved" :
                    d.status === "edited"   ? "✎ Edited draft"  :
                                             "✦ Clyde's draft reply";

                  return (
                    <div style={{
                      marginBottom: 14,
                      background: cardBg,
                      border: `1px solid ${borderColor}`,
                      borderLeft: `3px solid ${isApproved ? "#16A34A" : "#2563EB"}`,
                      borderRadius: "0 8px 8px 0",
                      overflow: "hidden",
                    }}>
                      {/* Draft header */}
                      <div style={{
                        padding: "8px 14px",
                        background: headerBg,
                        borderBottom: `1px solid ${borderColor}`,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: textColor }}>{label}</span>
                        <span style={{ fontSize: 10, color: "#9CA3AF" }}>
                          {Math.round(Number(d.confidence) * 100)}% confidence
                        </span>
                      </div>

                      {/* Draft body */}
                      <div style={{ padding: "12px 14px" }}>
                        {d.draftSubject && (
                          <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 6 }}>
                            Subject: <span style={{ color: "#5D5D5D" }}>{d.draftSubject}</span>
                          </div>
                        )}
                        <p style={{ margin: "0 0 14px", color: "#1A1A1A", fontSize: 13, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
                          {d.draftBody}
                        </p>
                        <DraftActions
                          draftId={d.id}
                          threadId={selectedThread.id}
                          draftBody={d.draftBody}
                          hasGmailThread={Boolean(selectedThread.gmailThreadId)}
                          category={detail.classification?.category}
                        />
                      </div>

                      {/* Mark sent strip — only when approved and waiting for manual send */}
                      {workflowState === "approved_ready_to_send" && (
                        <div style={{
                          padding: "9px 14px",
                          borderTop: `1px solid ${borderColor}`,
                          background: headerBg,
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          flexWrap: "wrap" as const,
                        }}>
                          <CopyButton text={d.draftBody} />
                          <span style={{ fontSize: 11, color: "#6B7280", flex: 1 }}>
                            Copy → paste into your email client → then mark as sent
                          </span>
                          <MarkSentForm threadId={selectedThread.id} />
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Rejected draft notice */}
                {detail.draft?.status === "rejected" && (
                  <div style={{ marginBottom: 10, padding: "8px 12px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 6, fontSize: 12, color: "#9CA3AF" }}>
                    Draft rejected.
                  </div>
                )}

                {/* Resolve banner — compact */}
                {workflowState === "sent" && (
                  <div style={{
                    marginBottom: 14,
                    padding: "9px 14px",
                    background: "#F0FDF4",
                    border: "1px solid #D1FAE5",
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}>
                    <span style={{ fontSize: 12, color: "#16A34A", fontWeight: 500 }}>
                      ✓ Reply sent — resolve when fully handled
                    </span>
                    <ResolveThreadForm threadId={selectedThread.id} />
                  </div>
                )}

                {/* Generate / reply prompt */}
                {firstInbound && (!hasDraft || detail.draft?.status === "rejected") && (
                  <div style={{
                    padding: "10px 14px",
                    background: "#FFFFFF",
                    border: "1px dashed #DBEAFE",
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 16,
                  }}>
                    <span style={{ fontSize: 12, color: "#9CA3AF", flex: 1 }}>
                      {detail.draft?.status === "rejected" ? "Generate a new draft reply" : "No draft yet — let Clyde draft a reply"}
                    </span>
                    <GenerateDraftForm
                      messageId={firstInbound.id}
                      classificationId={detail.classification?.id}
                      loadId={detail.matchedLoad?.id}
                      threadId={selectedThread.id}
                    />
                  </div>
                )}

              </div>
            </div>
          </>
        ) : !isLoading ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#C4C4C4", fontSize: 13 }}>
            Select a thread to begin
          </div>
        ) : null}
      </div>

      {/* ── Right: context panel (toggle with \ or button) ──────────────── */}
      {rightOpen && selectedThread && detail && (
        <div className="inbox-right" style={{ width: 296, minWidth: 296, borderLeft: "1px solid #EBEBEB", display: "flex", flexDirection: "column", overflow: "hidden", background: "#FFFFFF" }}>
          <RightContextPanel
            matchedLoad={detail.matchedLoad}
            classification={detail.classification}
            appliedSops={detail.appliedSops}
            loadDocs={detail.loadDocs}
            timeline={detail.timeline}
            threadId={selectedThread.id}
            currentStatus={selectedThread.status as Parameters<typeof RightContextPanel>[0]["currentStatus"]}
          />
        </div>
      )}
      </div>{/* end content row */}
    </div>
  );
}
