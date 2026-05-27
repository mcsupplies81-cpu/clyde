"use client";

import { useState, useActionState } from "react";
import { chaseDocumentAction, type ChaseResult } from "./actions";

interface Props {
  loadId: string;
  loadNumber: string;
  docType: string;
  carrierName?: string | null;
  defaultCarrierEmail?: string | null;
}

function defaultMessage(docType: string, loadNumber: string, carrierName?: string | null) {
  const greeting = carrierName ? `Hi ${carrierName} team,` : "Hi,";
  const docLower = docType.toLowerCase();
  return `${greeting}

Could you please send over the ${docLower} for Load #${loadNumber}? We need it to complete the billing process.

Thank you!`;
}

export function ChaseDocumentButton({
  loadId,
  loadNumber,
  docType,
  carrierName,
  defaultCarrierEmail,
}: Props) {
  const [open, setOpen] = useState(false);
  const [result, action, isPending] = useActionState<ChaseResult | null, FormData>(chaseDocumentAction, null);

  // Auto-close on success after a beat
  const sent = result?.ok === true;

  if (sent) {
    return (
      <span style={{
        fontSize: 11, fontWeight: 600,
        color: "#16A34A", background: "#F0FDF4",
        border: "1px solid #BBF7D0",
        padding: "2px 10px", borderRadius: 4,
      }}>
        ✓ {result.mode === "dry-run" ? "Drafted (dry run)" : "Sent"}
      </span>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          fontSize: 11, fontWeight: 600,
          color: "#2563EB", background: "none",
          border: "1px solid #BFDBFE",
          padding: "2px 10px", borderRadius: 4,
          cursor: "pointer",
        }}
      >
        Chase →
      </button>
    );
  }

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
        Chase {docType} — Load #{loadNumber}
      </div>

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
            rows={6}
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

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="submit"
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
            {isPending ? "Sending…" : "Send Chase Email"}
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
      </form>
    </div>
  );
}
