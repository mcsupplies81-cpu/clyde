"use client";

import { useState, useTransition } from "react";
import { runAutopilotAction } from "../inbox/actions";
import type { AutopilotResult } from "../inbox/actions";

export function AutopilotClient() {
  const [result, setResult] = useState<AutopilotResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRun() {
    setResult(null);
    startTransition(async () => {
      const res = await runAutopilotAction();
      setResult(res);
    });
  }

  return (
    <>
      {/* Run button row */}
      <div style={rowStyle}>
        <div>
          <div style={labelStyle}>Run autopilot now</div>
          <div style={subtleStyle}>Processes all open threads: classify, draft, and send where safe</div>
        </div>
        <button
          type="button"
          onClick={handleRun}
          disabled={isPending}
          style={{
            border: "none",
            borderRadius: 6,
            padding: "6px 16px",
            fontSize: 12,
            fontWeight: 600,
            cursor: isPending ? "not-allowed" : "pointer",
            background: isPending ? "#F2F2F2" : "#2563EB",
            color: isPending ? "#9CA3AF" : "#FFFFFF",
            flexShrink: 0,
            transition: "background 0.15s",
          }}
        >
          {isPending ? "Running…" : "▶ Run Now"}
        </button>
      </div>

      {/* Result banner */}
      {result && (
        <div style={{
          margin: "4px 0 2px",
          padding: "10px 14px",
          background: result.autoSent > 0 ? "#F0FDF4" : "#EFF6FF",
          border: `1px solid ${result.autoSent > 0 ? "#D1FAE5" : "#BFDBFE"}`,
          borderRadius: 6,
          fontSize: 12,
        }}>
          <div style={{ fontWeight: 700, color: result.autoSent > 0 ? "#15803D" : "#1D4ED8", marginBottom: 6 }}>
            ✓ Autopilot complete · {new Date(result.timestamp).toLocaleTimeString()}
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", color: "#5D5D5D" }}>
            <span>Open threads: <strong style={{ color: "#292929" }}>{result.total}</strong></span>
            <span>Classified: <strong style={{ color: "#2563EB" }}>{result.classified}</strong></span>
            <span>Drafted: <strong style={{ color: "#D97706" }}>{result.drafted}</strong></span>
            <span>Auto-sent: <strong style={{ color: "#16A34A" }}>{result.autoSent}</strong></span>
            <span>Skipped: <strong style={{ color: "#9CA3AF" }}>{result.skipped}</strong></span>
          </div>
        </div>
      )}

      {/* Category routing rows */}
      <div style={rowStyle}>
        <div>
          <div style={labelStyle}>Full-auto categories</div>
          <div style={subtleStyle}>Classify → draft → approve → send automatically</div>
        </div>
        <div style={pillListStyle}>
          {["status", "pod", "bol", "carrier update", "rate conf"].map((c) => (
            <span key={c} style={{ ...pillStyle, background: "#F0FDF4", color: "#15803D", border: "1px solid #D1FAE5" }}>{c}</span>
          ))}
        </div>
      </div>

      <div style={rowStyle}>
        <div>
          <div style={labelStyle}>Draft-only categories</div>
          <div style={subtleStyle}>Classify + draft - human approval required before sending</div>
        </div>
        <div style={pillListStyle}>
          {["detention", "billing", "appointment", "quote"].map((c) => (
            <span key={c} style={{ ...pillStyle, background: "#FFFBEB", color: "#D97706", border: "1px solid #FDE68A" }}>{c}</span>
          ))}
        </div>
      </div>

      <div style={rowStyle}>
        <div>
          <div style={labelStyle}>Classify-only categories</div>
          <div style={subtleStyle}>Classified and flagged - no draft generated</div>
        </div>
        <div style={pillListStyle}>
          {["escalation", "unknown"].map((c) => (
            <span key={c} style={{ ...pillStyle, background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" }}>{c}</span>
          ))}
        </div>
      </div>
    </>
  );
}

const rowStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  padding: "10px 0",
  borderTop: "1px solid #F2F2F2",
} as const;

const labelStyle  = { fontSize: 13, color: "#292929", fontWeight: 500 } as const;
const subtleStyle = { marginTop: 3, fontSize: 11, color: "#9CA3AF" } as const;

const pillListStyle = {
  display: "flex",
  gap: 4,
  flexWrap: "wrap" as const,
  justifyContent: "flex-end",
  maxWidth: 200,
} as const;

const pillStyle = {
  padding: "2px 8px",
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 600,
  whiteSpace: "nowrap" as const,
} as const;
