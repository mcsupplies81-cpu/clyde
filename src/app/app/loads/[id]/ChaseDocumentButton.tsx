"use client";

import { useState, useActionState } from "react";
import { chaseDocumentAction, cancelChaseFollowUpAction, type ChaseResult } from "./actions";

interface ActiveFollowUp {
  id: string;
  sendCount: number;
  maxSends: number;
  nextSendAt: string;
  messageTemplate: string;
}

interface Props {
  loadId: string;
  loadNumber: string;
  docType: string;
  carrierName?: string | null;
  defaultCarrierEmail?: string | null;
  lastChasedAt?: string | null;
  activeFollowUp?: ActiveFollowUp | null;
}

function defaultMessage(docType: string, loadNumber: string, carrierName?: string | null) {
  const greeting = carrierName ? `Hi ${carrierName} team,` : "Hi,";
  const docLower = docType.toLowerCase();
  return `${greeting}

Could you please send over the ${docLower} for Load #${loadNumber}? We need it to complete the billing process.

Thank you!`;
}

function relDays(isoString: string): string {
  const ms = Date.now() - new Date(isoString).getTime();
  const days = Math.round(ms / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

function fmtDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ChaseDocumentButton({
  loadId,
  loadNumber,
  docType,
  carrierName,
  defaultCarrierEmail,
  lastChasedAt,
  activeFollowUp,
}: Props) {
  const [open, setOpen]       = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [cancelPending, setCancelPending] = useState(false);
  const [result, action, isPending] = useActionState<ChaseResult | null, FormData>(chaseDocumentAction, null);

  const sent = result?.ok === true;

  async function handleCancel(followUpId: string) {
    setCancelPending(true);
    await cancelChaseFollowUpAction(followUpId, loadId);
    setCancelPending(false);
  }

  // Success state — shown after sending
  if (sent) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
        <span style={{
          fontSize: 11, fontWeight: 600,
          color: "#16A34A", background: "#F0FDF4",
          border: "1px solid #BBF7D0",
          padding: "2px 10px", borderRadius: 4,
        }}>
          ✓ {result.mode === "dry-run" ? "Drafted (dry run)" : (result.followUpId ? "Sent - follow-up scheduled" : "Sent")}
        </span>
        {result.followUpId && (
          <span style={{ fontSize: 10, color: "#9CA3AF" }}>
            Follow-ups: every 2 days, up to 3 total
          </span>
        )}
      </div>
    );
  }

  // Closed state — chase button (aware of history)
  if (!open) {
    const alreadyChased = !!lastChasedAt;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            fontSize: 11, fontWeight: 600,
            color: alreadyChased ? "#D97706" : "#2563EB",
            background: "none",
            border: `1px solid ${alreadyChased ? "#FDE68A" : "#BFDBFE"}`,
            padding: "2px 10px", borderRadius: 4,
            cursor: "pointer",
          }}
        >
          {alreadyChased ? `Chased ${relDays(lastChasedAt)} - Chase again →` : "Chase →"}
        </button>

        {/* Active follow-up status badge */}
        {activeFollowUp && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10, color: "#7C3AED", background: "#F5F3FF", border: "1px solid #DDD6FE", padding: "1px 7px", borderRadius: 3, fontWeight: 600 }}>
              🔄 Follow-up {activeFollowUp.sendCount}/{activeFollowUp.maxSends} - Next: {fmtDate(activeFollowUp.nextSendAt)}
            </span>
            <button
              type="button"
              onClick={() => handleCancel(activeFollowUp.id)}
              disabled={cancelPending}
              style={{ fontSize: 10, color: "#9CA3AF", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}
            >
              {cancelPending ? "Cancelling..." : "Cancel"}
            </button>
          </div>
        )}
      </div>
    );
  }

  // Open form state
  return (
    <div style={{
      marginTop: 10,
      background: "#F8FBFF",
      border: "1px solid #BFDBFE",
      borderRadius: 8,
      padding: 14,
      width: "100%",
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#1D4ED8", marginBottom: 10 }}>
        Chase {docType}: Load #{loadNumber}
      </div>

      {/* Previous chase notice */}
      {lastChasedAt && (
        <div style={{ fontSize: 11, color: "#D97706", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 4, padding: "5px 8px", marginBottom: 10 }}>
          ⚠ Previously chased {relDays(lastChasedAt)}. Sending again will be follow-up #{(activeFollowUp?.sendCount ?? 0) + 2}.
        </div>
      )}

      <form action={action}>
        <input type="hidden" name="loadId" value={loadId} />
        <input type="hidden" name="docType" value={docType} />

        {/* Carrier email */}
        <div style={{ marginBottom: 8 }}>
          <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#6B7280", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.4px" }}>
            Carrier email
          </label>
          <input
            name="carrierEmail"
            type="email"
            required
            defaultValue={defaultCarrierEmail ?? ""}
            placeholder={`carrier@${carrierName?.toLowerCase().replace(/\s+/g, "") ?? "example"}.com`}
            style={{
              width: "100%", boxSizing: "border-box",
              background: "#FFFFFF", border: "1px solid #DBEAFE",
              borderRadius: 5, padding: "6px 8px",
              fontSize: 12, color: "#111827", outline: "none",
            }}
          />
        </div>

        {/* Message */}
        <div style={{ marginBottom: 10 }}>
          <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#6B7280", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.4px" }}>
            Message
          </label>
          <textarea
            name="message"
            required
            rows={5}
            defaultValue={defaultMessage(docType, loadNumber, carrierName)}
            style={{
              width: "100%", boxSizing: "border-box",
              background: "#FFFFFF", border: "1px solid #DBEAFE",
              borderRadius: 5, padding: "6px 8px",
              fontSize: 12, color: "#111827", outline: "none",
              lineHeight: 1.6, resize: "vertical" as const,
              fontFamily: "inherit",
            }}
          />
        </div>

        {result?.ok === false && (
          <div style={{ fontSize: 11, color: "#DC2626", marginBottom: 8, background: "#FEF2F2", padding: "5px 8px", borderRadius: 4 }}>
            {result.error}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <button
            type="submit"
            name="withFollowUp"
            value="false"
            disabled={isPending}
            style={{
              flex: 1,
              padding: "7px 0",
              background: isPending ? "#93C5FD" : "#2563EB",
              border: "none", borderRadius: 5,
              color: "#FFFFFF", fontSize: 12, fontWeight: 600,
              cursor: isPending ? "default" : "pointer",
            }}
          >
            {isPending ? "Sending..." : "Send Once"}
          </button>
          <button
            type="submit"
            name="withFollowUp"
            value="true"
            disabled={isPending}
            style={{
              flex: 1,
              padding: "7px 0",
              background: isPending ? "#D8B4FE" : "#7C3AED",
              border: "none", borderRadius: 5,
              color: "#FFFFFF", fontSize: 12, fontWeight: 600,
              cursor: isPending ? "default" : "pointer",
            }}
          >
            {isPending ? "Sending..." : "Send + Follow Up"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            style={{
              padding: "7px 14px",
              background: "none", border: "1px solid #E5E7EB",
              borderRadius: 5, fontSize: 12, color: "#6B7280",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>

        {/* Follow-up sequence preview */}
        <div>
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            style={{ fontSize: 10, color: "#7C3AED", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}
          >
            {showPreview ? "Hide" : "What does \"Send + Follow Up\" do?"}
          </button>
          {showPreview && (
            <div style={{ marginTop: 6, padding: "8px 10px", background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: 5, fontSize: 11, color: "#5B21B6", lineHeight: 1.6 }}>
              <strong>How follow-ups work:</strong>
              <ul style={{ margin: "4px 0 0 14px", padding: 0 }}>
                <li>Sends the message above right now</li>
                <li>Automatically resends the same message every <strong>2 days</strong></li>
                <li>Stops after <strong>3 total emails</strong> (including this one)</li>
                <li>Subject line will be: <em>[Follow-up 2] {docType} Request: Load #{loadNumber}</em></li>
                <li>You can cancel the sequence at any time from this page</li>
              </ul>
              <div style={{ marginTop: 4, color: "#7C3AED", fontSize: 10 }}>
                Note: follow-up content matches whatever you write above.
              </div>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
