"use client";

import { useState } from "react";
import type { ResolutionPlanData } from "@/lib/resolution";

const S = {
  card: {
    background: "#FFFFFF",
    border: "1px solid #E8E8E8",
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 16,
  } as React.CSSProperties,
  cardHeader: {
    padding: "10px 14px",
    borderBottom: "1px solid #F2F2F2",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#FAFAF8",
  } as React.CSSProperties,
  label: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.8px",
    color: "#7F7F7F",
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: "#5D5D5D",
    textTransform: "uppercase" as const,
    letterSpacing: "0.6px",
    marginBottom: 6,
  },
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={S.label}>{children}</div>;
}

export function ResolutionPlan({
  plan,
}: {
  plan: ResolutionPlanData;
}) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const toggle = (id: string) => setChecked((prev) => ({ ...prev, [id]: !prev[id] }));

  const allDone = plan.steps.every((s) => checked[s.id]);

  return (
    <div style={S.card}>
      {/* Header */}
      <div style={S.cardHeader}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14 }}>🤖</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#292929" }}>Clyde&apos;s Plan</span>
        </div>
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          color: allDone ? "#16A34A" : "#2563EB",
          background: allDone ? "#F0FDF4" : "#EFF6FF",
          padding: "2px 8px",
          borderRadius: 10,
        }}>
          {allDone ? "✓ Complete" : `${Object.values(checked).filter(Boolean).length}/${plan.steps.length} steps`}
        </span>
      </div>

      <div style={{ padding: "14px 16px" }}>
        {/* Issue Summary */}
        <div style={{ marginBottom: 14 }}>
          <SectionLabel>Issue Summary</SectionLabel>
          <p style={{ margin: 0, fontSize: 13, color: "#292929", lineHeight: 1.6 }}>
            {plan.issueSummary}
          </p>
        </div>

        {/* What Clyde Knows + Missing Info */}
        {(plan.whatClydeKnows.length > 0 || plan.missingInformation.length > 0) && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            {plan.whatClydeKnows.length > 0 && (
              <div>
                <SectionLabel>What Clyde Knows</SectionLabel>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {plan.whatClydeKnows.map(({ label, value }) => (
                    <div key={label} style={{ fontSize: 11, display: "flex", gap: 4, alignItems: "baseline" }}>
                      <span style={{ color: "#9CA3AF", whiteSpace: "nowrap", minWidth: 60 }}>{label}</span>
                      <span style={{ color: "#292929", fontWeight: 500, wordBreak: "break-word" }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {plan.missingInformation.length > 0 && (
              <div>
                <SectionLabel>Missing Info</SectionLabel>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {plan.missingInformation.map((item, i) => (
                    <div key={i} style={{ fontSize: 11, display: "flex", gap: 5, alignItems: "flex-start" }}>
                      <span style={{ color: "#F59E0B", flexShrink: 0, marginTop: 1 }}>⚠</span>
                      <span style={{ color: "#5D5D5D" }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Recommended Next Steps */}
        <div style={{ marginBottom: 14 }}>
          <SectionLabel>Recommended Next Steps</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {plan.steps.map((step) => {
              const done = !!checked[step.id];
              return (
                <div
                  key={step.id}
                  onClick={() => toggle(step.id)}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                    cursor: "pointer",
                    padding: "6px 8px",
                    borderRadius: 6,
                    background: done ? "#F0FDF4" : "#FAFAF8",
                    border: `1px solid ${done ? "#D1FAE5" : "#F2F2F2"}`,
                    transition: "background 0.1s",
                  }}
                >
                  {/* Checkbox */}
                  <div style={{
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    border: `2px solid ${done ? "#16A34A" : "#D1D5DB"}`,
                    background: done ? "#16A34A" : "#FFFFFF",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: 1,
                  }}>
                    {done && (
                      <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                        <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <div style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: done ? "#6B7280" : "#292929",
                      textDecoration: done ? "line-through" : "none",
                      lineHeight: 1.4,
                    }}>
                      {step.label}
                    </div>
                    {step.detail && !done && (
                      <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>{step.detail}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Customer Track + Carrier Track */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {/* Customer Track */}
          <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ ...S.sectionTitle, color: "#1D4ED8", marginBottom: 8 }}>Customer Track</div>
            <Row label="Goal" value={plan.customerTrack.goal} />
            {plan.customerTrack.sla && <Row label="SLA" value={plan.customerTrack.sla} />}
            {plan.customerTrack.draftAction && <Row label="Action" value={plan.customerTrack.draftAction} />}
            {plan.customerTrack.warnings?.map((w, i) => (
              <div key={i} style={{ marginTop: 5, fontSize: 11, color: "#B45309", display: "flex", gap: 5 }}>
                <span>⚠</span><span>{w}</span>
              </div>
            ))}
          </div>

          {/* Carrier Track */}
          <div style={{ background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ ...S.sectionTitle, color: "#6D28D9", marginBottom: 8 }}>Carrier Track</div>
            <Row label="Goal" value={plan.carrierTrack.goal} />
            {plan.carrierTrack.owner && <Row label="Owner" value={plan.carrierTrack.owner} />}
            {plan.carrierTrack.whatNeeded && <Row label="Needs" value={plan.carrierTrack.whatNeeded} />}
            {plan.carrierTrack.status && <Row label="Status" value={plan.carrierTrack.status} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 4, marginBottom: 4, alignItems: "flex-start" }}>
      <span style={{ fontSize: 10, color: "#9CA3AF", whiteSpace: "nowrap", paddingTop: 1, minWidth: 40 }}>{label}</span>
      <span style={{ fontSize: 11, color: "#292929", lineHeight: 1.4 }}>{value}</span>
    </div>
  );
}
