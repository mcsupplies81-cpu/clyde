"use client";

import { useState } from "react";
import { createPilotAction } from "./actions";

export function NewPilotForm() {
  const [result, setResult]   = useState<{ inviteUrl?: string; error?: string } | null>(null);
  const [saving, setSaving]   = useState(false);
  const [copied, setCopied]   = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setResult(null);
    setCopied(false);
    const fd = new FormData(e.currentTarget);
    const res = await createPilotAction(fd);
    setSaving(false);
    setResult(res);
    if (!res.error) (e.target as HTMLFormElement).reset();
  }

  function copyLink() {
    if (result?.inviteUrl) {
      navigator.clipboard.writeText(result.inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div style={{ background: "#1E293B", borderRadius: 12, padding: 20 }}>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>

        <Field label="Company name *">
          <input name="companyName" required placeholder="Acme Freight LLC" style={inputStyle} />
        </Field>

        <Field label="Contact email">
          <input name="contactEmail" type="email" placeholder="sarah@acmefreight.com" style={inputStyle} />
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Plan">
            <select name="plan" style={inputStyle} defaultValue="pilot">
              <option value="pilot">Pilot</option>
              <option value="paid">Paid</option>
            </select>
          </Field>
          <Field label="Seats">
            <input name="seatLimit" type="number" min="1" defaultValue="5" style={inputStyle} />
          </Field>
        </div>

        <Field label="Trial length (days)">
          <input name="trialDays" type="number" min="1" defaultValue="30" style={inputStyle} />
        </Field>

        <Field label="Internal notes">
          <textarea
            name="notes"
            placeholder="e.g. Met at FreightWaves — uses McLeod TMS"
            rows={3}
            style={{ ...inputStyle, resize: "vertical" as const, fontFamily: "inherit" }}
          />
        </Field>

        <button
          type="submit"
          disabled={saving}
          style={{ background: "#2563EB", color: "#FFF", border: "none", borderRadius: 7, padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: saving ? 0.7 : 1 }}
        >
          {saving ? "Creating…" : "Create Pilot + Generate Invite"}
        </button>
      </form>

      {/* Result */}
      {result?.error && (
        <div style={{ marginTop: 12, padding: "10px 14px", background: "#450A0A", border: "1px solid #7F1D1D", borderRadius: 8, fontSize: 12, color: "#FCA5A5" }}>
          {result.error}
        </div>
      )}

      {result?.inviteUrl && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, color: "#22C55E", fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            ✓ Pilot created — send this link:
          </div>
          <div style={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 8, padding: "10px 12px", fontSize: 11, fontFamily: "monospace", color: "#7DD3FC", wordBreak: "break-all" as const, marginBottom: 10 }}>
            {result.inviteUrl}
          </div>
          <button
            onClick={copyLink}
            style={{ width: "100%", background: copied ? "#166534" : "#134E4A", color: copied ? "#86EFAC" : "#2DD4BF", border: "none", borderRadius: 7, padding: "9px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          >
            {copied ? "✓ Copied!" : "Copy invite link"}
          </button>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.4px" }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "#0F172A",
  border: "1px solid #334155",
  borderRadius: 6,
  color: "#F8FAFC",
  padding: "8px 10px",
  fontSize: 13,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};
