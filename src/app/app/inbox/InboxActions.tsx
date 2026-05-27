"use client";

import { useState, useEffect, useCallback, useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import {
  classifyMessageAction,
  generateDraftAction,
  approveDraftAction,
  rejectDraftAction,
  editDraftAction,
  markSentManuallyAction,
  resolveThreadAction,
  sendDraftViaGmailAction,
  demoSendDraftAction,
} from "./actions";

function SubmitButton({
  label,
  pendingLabel,
  style,
  shortcutKey,
}: {
  label: string;
  pendingLabel: string;
  style: CSSProperties;
  shortcutKey?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      data-shortcut={shortcutKey}
      style={{ ...style, opacity: pending ? 0.6 : 1, cursor: pending ? "wait" : "pointer" }}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

// ─── Classify ────────────────────────────────────────────────────────────────

export function ClassifyForm({
  message,
  hasClassification,
  threadId,
}: {
  message: { id: string; subject: string | null; body: string; senderName: string | null; senderEmail: string };
  hasClassification?: boolean;
  threadId?: string;
}) {
  return (
    <form action={classifyMessageAction} style={{ marginTop: 10 }}>
      <input type="hidden" name="messageId"   value={message.id} />
      <input type="hidden" name="subject"     value={message.subject ?? ""} />
      <input type="hidden" name="body"        value={message.body} />
      <input type="hidden" name="senderName"  value={message.senderName ?? ""} />
      <input type="hidden" name="senderEmail" value={message.senderEmail} />
      {threadId && <input type="hidden" name="threadId" value={threadId} />}
      <SubmitButton
        label={hasClassification ? "Re-classify" : "Classify with AI"}
        pendingLabel="Classifying…"
        style={{
          padding: "5px 12px",
          background: "#EFF6FF",
          color: "#2563EB",
          border: "1px solid #BFDBFE",
          borderRadius: 5,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.2px",
        }}
      />
    </form>
  );
}

// ─── Generate draft ───────────────────────────────────────────────────────────

export function GenerateDraftForm({
  messageId,
  classificationId,
  loadId,
  threadId,
}: {
  messageId: string;
  classificationId?: string;
  loadId?: string;
  threadId?: string;
}) {
  return (
    <form action={generateDraftAction}>
      <input type="hidden" name="messageId" value={messageId} />
      {classificationId && <input type="hidden" name="classificationId" value={classificationId} />}
      {loadId && <input type="hidden" name="loadId" value={loadId} />}
      {threadId && <input type="hidden" name="threadId" value={threadId} />}
      <SubmitButton
        label="Generate Draft Reply"
        pendingLabel="Generating…"
        shortcutKey="generate"
        style={{
          padding: "9px 18px",
          background: "#2563EB",
          border: "none",
          borderRadius: 6,
          color: "#FFFFFF",
          fontSize: 12,
          fontWeight: 600,
        }}
      />
    </form>
  );
}

// ─── Draft actions (approve / edit / reject) ──────────────────────────────────

const BLOCKED_SEND_CATEGORIES = new Set(["detention_accessorial", "billing_invoice", "escalation", "unknown", "quote_request", "carrier_concern"]);

const BLOCKED_REASON: Record<string, string> = {
  detention_accessorial: "Detention & accessorial charges require human review before any response.",
  billing_invoice: "Billing disputes must be reviewed by your billing team before replying.",
  escalation: "Escalations require a direct human response — not an auto-draft.",
  quote_request: "Quotes need pricing review before sending.",
  carrier_concern: "Re-brokering and carrier compliance issues require human approval.",
  unknown: "Unclassified emails should be reviewed before sending.",
};

export function DraftActions({
  draftId,
  threadId,
  draftBody,
  hasGmailThread,
  category,
}: {
  draftId: string;
  threadId?: string;
  draftBody: string;
  hasGmailThread?: boolean;
  category?: string | null;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [sendState, sendFormAction, sendPending] = useActionState(sendDraftViaGmailAction, undefined);
  const [demoState, demoFormAction, demoPending] = useActionState(demoSendDraftAction, undefined);
  const isSendBlocked = category ? BLOCKED_SEND_CATEGORIES.has(category) : false;

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {!isEditing && (
        <>
          <form action={approveDraftAction}>
            <input type="hidden" name="draftId" value={draftId} />
            {threadId && <input type="hidden" name="threadId" value={threadId} />}
            <SubmitButton
              label="Approve Draft"
              pendingLabel="Approving…"
              shortcutKey="approve"
              style={{
                padding: "7px 14px",
                background: "#16A34A",
                color: "#FFFFFF",
                border: "none",
                borderRadius: 5,
                fontSize: 12,
                fontWeight: 700,
              }}
            />
          </form>
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            style={{
              padding: "7px 14px",
              background: "#F9FAFB",
              color: "#5D5D5D",
              border: "1px solid #E8E8E8",
              borderRadius: 5,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Edit
          </button>
          <form action={rejectDraftAction}>
            <input type="hidden" name="draftId" value={draftId} />
            <SubmitButton
              label="Reject"
              pendingLabel="Rejecting…"
              style={{
                padding: "7px 14px",
                background: "transparent",
                color: "#DC2626",
                border: "1px solid #FECACA",
                borderRadius: 5,
                fontSize: 12,
              }}
            />
          </form>
          {hasGmailThread && !isSendBlocked && (
            <form action={sendFormAction}>
              <input type="hidden" name="draftId" value={draftId} />
              {threadId && <input type="hidden" name="threadId" value={threadId} />}
              <button
                type="submit"
                disabled={sendPending}
                style={{
                  padding: "7px 14px",
                  background: sendPending ? "#E8E8E8" : "#0284C7",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: 5,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: sendPending ? "wait" : "pointer",
                  opacity: sendPending ? 0.7 : 1,
                }}
              >
                {sendPending ? "Sending…" : "Send via Gmail"}
              </button>
            </form>
          )}
          {/* Demo Send — always available, simulates a real send without Gmail */}
          {!isSendBlocked && (
            <form action={demoFormAction}>
              <input type="hidden" name="draftId" value={draftId} />
              {threadId && <input type="hidden" name="threadId" value={threadId} />}
              <button
                type="submit"
                disabled={demoPending}
                title="Simulates sending — creates an outbound record without a real email connection"
                style={{
                  padding: "7px 14px",
                  background: demoPending ? "#E8E8E8" : "#7C3AED",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: 5,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: demoPending ? "wait" : "pointer",
                  opacity: demoPending ? 0.7 : 1,
                }}
              >
                {demoPending ? "Sending…" : "⚡ Demo Send"}
              </button>
            </form>
          )}
          {isSendBlocked && (
            <div style={{ width: "100%", marginTop: 6 }}>
              <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>Manual send required</span>
              {category && BLOCKED_REASON[category] && (
                <span style={{ fontSize: 11, color: "#C4C4C4", marginLeft: 6 }}>— {BLOCKED_REASON[category]}</span>
              )}
            </div>
          )}
          {demoState?.success && (
            <div style={{ width: "100%", marginTop: 6, padding: "6px 10px", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 5, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: "#16A34A", fontWeight: 600 }}>✓ Sent</span>
              <span style={{ fontSize: 11, color: "#6B7280" }}>Thread moved to</span>
              <a href="?filter=sent" style={{ fontSize: 11, color: "#2563EB", fontWeight: 600, textDecoration: "none" }}>Sent tab →</a>
            </div>
          )}
          {sendState?.error && (
            <div style={{ width: "100%", color: "#DC2626", fontSize: 11, marginTop: 4 }}>{sendState.error}</div>
          )}
          {sendState?.success && (
            <div style={{ width: "100%", color: "#16A34A", fontSize: 11, marginTop: 4 }}>✓ Sent via Gmail</div>
          )}
        </>
      )}
      {isEditing && (
        <form action={editDraftAction} style={{ width: "100%" }}>
          <input type="hidden" name="draftId" value={draftId} />
          <textarea
            name="draftBody"
            required
            defaultValue={draftBody}
            style={{
              width: "100%",
              minHeight: 140,
              background: "#FFFFFF",
              color: "#292929",
              border: "1px solid #E8E8E8",
              borderRadius: 6,
              padding: 10,
              marginBottom: 8,
              fontSize: 13,
              lineHeight: 1.7,
              resize: "vertical",
              outline: "none",
            }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <SubmitButton
              label="Save & Re-submit"
              pendingLabel="Saving…"
              style={{
                padding: "7px 14px",
                background: "#2563EB",
                color: "#FFFFFF",
                border: "none",
                borderRadius: 5,
                fontSize: 12,
                fontWeight: 600,
              }}
            />
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              style={{
                padding: "7px 14px",
                background: "transparent",
                color: "#9CA3AF",
                border: "1px solid #E8E8E8",
                borderRadius: 5,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ─── Mark sent manually ───────────────────────────────────────────────────────

export function MarkSentForm({ threadId }: { threadId: string }) {
  return (
    <form action={markSentManuallyAction}>
      <input type="hidden" name="threadId" value={threadId} />
      <SubmitButton
        label="Mark as Sent Manually"
        pendingLabel="Marking…"
        shortcutKey="mark-sent"
        style={{
          padding: "8px 16px",
          background: "#16A34A",
          color: "#FFFFFF",
          border: "none",
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 700,
          width: "100%",
          textAlign: "left",
        }}
      />
    </form>
  );
}

// ─── Resolve thread ───────────────────────────────────────────────────────────

export function ResolveThreadForm({ threadId }: { threadId: string }) {
  return (
    <form action={resolveThreadAction}>
      <input type="hidden" name="threadId" value={threadId} />
      <SubmitButton
        label="Resolve Thread"
        pendingLabel="Resolving…"
        shortcutKey="resolve"
        style={{
          padding: "8px 16px",
          background: "#F0FDF4",
          color: "#16A34A",
          border: "1px solid #D1FAE5",
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 700,
          width: "100%",
          textAlign: "left",
        }}
      />
    </form>
  );
}

// ─── Copy to clipboard ────────────────────────────────────────────────────────

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      style={{
        padding: "7px 14px",
        background: "#F9FAFB",
        color: copied ? "#16A34A" : "#2563EB",
        border: `1px solid ${copied ? "#D1FAE5" : "#BFDBFE"}`,
        borderRadius: 5,
        fontSize: 12,
        cursor: "pointer",
        fontWeight: 500,
        transition: "color 0.15s, border-color 0.15s",
      }}
    >
      {copied ? "Copied!" : "Copy to Clipboard"}
    </button>
  );
}

// ─── Keyboard navigation ──────────────────────────────────────────────────────

export function KeyboardNav({
  threadIds,
  currentId,
  filter,
  canGenerate,
  canApprove,
  canMarkSent,
  canResolve,
}: {
  threadIds: string[];
  currentId: string | undefined;
  filter?: string;
  canGenerate?: boolean;
  canApprove?: boolean;
  canMarkSent?: boolean;
  canResolve?: boolean;
}) {
  const router = useRouter();

  const navigate = useCallback(
    (dir: "next" | "prev") => {
      const idx = threadIds.indexOf(currentId ?? "");
      const filterParam = filter ? `&filter=${filter}` : "";
      if (dir === "next") {
        const next = threadIds[idx + 1];
        if (next) router.push(`/app/inbox?threadId=${next}${filterParam}`);
      } else {
        const prev = threadIds[idx - 1];
        if (prev) router.push(`/app/inbox?threadId=${prev}${filterParam}`);
      }
    },
    [threadIds, currentId, filter, router],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      switch (e.key) {
        case "j": case "ArrowDown": e.preventDefault(); navigate("next"); break;
        case "k": case "ArrowUp":   e.preventDefault(); navigate("prev"); break;
        case "g": if (canGenerate) { e.preventDefault(); (document.querySelector("[data-shortcut='generate']") as HTMLButtonElement)?.click(); } break;
        case "a": if (canApprove)  { e.preventDefault(); (document.querySelector("[data-shortcut='approve']") as HTMLButtonElement)?.click(); } break;
        case "s": if (canMarkSent) { e.preventDefault(); (document.querySelector("[data-shortcut='mark-sent']") as HTMLButtonElement)?.click(); } break;
        case "r": if (canResolve)  { e.preventDefault(); (document.querySelector("[data-shortcut='resolve']") as HTMLButtonElement)?.click(); } break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, canGenerate, canApprove, canMarkSent, canResolve]);

  return null;
}

// ─── Shortcuts hint ───────────────────────────────────────────────────────────

export function ShortcutHint() {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      {[
        ["J/K", "Navigate"],
        ["G", "Generate"],
        ["A", "Approve"],
        ["S", "Mark Sent"],
        ["R", "Resolve"],
      ].map(([key, label]) => (
        <span key={key} style={{ fontSize: 10, color: "#9CA3AF", display: "flex", alignItems: "center", gap: 4 }}>
          <kbd style={{ background: "#F9FAFB", border: "1px solid #E8E8E8", borderRadius: 3, padding: "0 4px", fontFamily: "monospace", fontSize: 9, color: "#5D5D5D" }}>{key}</kbd>
          {label}
        </span>
      ))}
    </div>
  );
}
