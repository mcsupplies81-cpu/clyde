"use client";

import Link from "next/link";
import type { ThreadDetail } from "@/lib/inbox-thread-detail";

type Load = NonNullable<ThreadDetail["matchedLoad"]>;
type Classification = ThreadDetail["classification"];

function fmt(d: Date | string | null | undefined) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function StatusPill({ status }: { status: string | null | undefined }) {
  if (!status) return null;
  const s = status.toLowerCase();
  const color =
    s.includes("transit")   ? { bg: "#EFF6FF", text: "#2563EB", dot: "#2563EB" } :
    s.includes("deliver")   ? { bg: "#F0FDF4", text: "#15803D", dot: "#16A34A" } :
    s.includes("exception") ? { bg: "#FEF2F2", text: "#DC2626", dot: "#DC2626" } :
    s.includes("pickup") || s.includes("dispatch") ? { bg: "#FFFBEB", text: "#B45309", dot: "#D97706" } :
                              { bg: "#F5F5F5", text: "#6B7280", dot: "#9CA3AF" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: color.bg, color: color.text,
      fontSize: 11, fontWeight: 600,
      padding: "2px 8px", borderRadius: 20,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: color.dot, flexShrink: 0 }} />
      {status}
    </span>
  );
}

function RiskPill({ level }: { level: string | null | undefined }) {
  if (!level || level === "low" || level === "normal") return null;
  const color =
    level === "critical" ? { bg: "#FEF2F2", text: "#DC2626" } :
    level === "high"     ? { bg: "#FFF7ED", text: "#EA580C" } :
                           { bg: "#FFFBEB", text: "#B45309" };
  return (
    <span style={{
      background: color.bg, color: color.text,
      fontSize: 10, fontWeight: 700,
      padding: "2px 7px", borderRadius: 4,
      textTransform: "uppercase", letterSpacing: "0.3px",
    }}>
      {level} risk
    </span>
  );
}

// ── Card when load IS matched ──────────────────────────────────────────────────

function MatchedLoadCard({ load, confidence }: { load: Load; confidence: number }) {
  const route =
    load.originCity && load.destinationCity
      ? `${load.originCity}, ${load.originState} → ${load.destinationCity}, ${load.destinationState}`
      : null;

  const eta = fmt(load.eta) ?? fmt(load.deliveryAt);

  return (
    <div style={{
      marginBottom: 14,
      background: "#F8FBFF",
      border: "1px solid #BFDBFE",
      borderLeft: "3px solid #2563EB",
      borderRadius: "0 8px 8px 0",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "7px 14px",
        background: "#EFF6FF",
        borderBottom: "1px solid #DBEAFE",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, color: "#93C5FD" }}>📦</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#1D4ED8", fontFamily: "monospace", letterSpacing: "0.3px" }}>
            {load.loadNumber}
          </span>
          <span style={{ fontSize: 10, color: "#93C5FD", fontWeight: 500 }}>
            · Clyde matched this load
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, color: "#93C5FD" }}>{confidence}% match</span>
          <Link
            href={`/app/loads/${load.id}`}
            style={{
              fontSize: 11, fontWeight: 600, color: "#2563EB",
              textDecoration: "none", padding: "2px 8px",
              background: "#DBEAFE", borderRadius: 4,
            }}
          >
            View load →
          </Link>
        </div>
      </div>

      {/* Data */}
      <div style={{
        padding: "10px 14px",
        display: "flex",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
      }}>
        {/* Route */}
        {route && (
          <span style={{ fontSize: 13, fontWeight: 600, color: "#1E3A5F" }}>
            {route}
          </span>
        )}

        {/* Status */}
        <StatusPill status={load.currentStatus} />

        {/* Risk */}
        <RiskPill level={load.riskLevel} />

        {/* Carrier */}
        {load.carrierName && (
          <span style={{ fontSize: 11, color: "#6B7280" }}>
            Carrier: <span style={{ fontWeight: 600, color: "#374151" }}>{load.carrierName}</span>
          </span>
        )}

        {/* ETA / delivery */}
        {eta && (
          <span style={{ fontSize: 11, color: "#6B7280" }}>
            {load.eta ? "ETA" : "Delivery"}: <span style={{ fontWeight: 600, color: "#374151" }}>{eta}</span>
          </span>
        )}

        {/* Driver */}
        {load.driverName && (
          <span style={{ fontSize: 11, color: "#6B7280" }}>
            Driver: <span style={{ fontWeight: 600, color: "#374151" }}>{load.driverName}</span>
          </span>
        )}
      </div>
    </div>
  );
}

// ── Card when load number extracted but NOT found ─────────────────────────────

function UnmatchedLoadCard({ loadNumber }: { loadNumber: string }) {
  return (
    <div style={{
      marginBottom: 14,
      background: "#FAFAF8",
      border: "1px solid #E5E7EB",
      borderLeft: "3px solid #D1D5DB",
      borderRadius: "0 8px 8px 0",
      padding: "9px 14px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#9CA3AF", fontFamily: "monospace" }}>
          {loadNumber}
        </span>
        <span style={{ fontSize: 11, color: "#9CA3AF" }}>— not found in your load board</span>
      </div>
      <Link
        href="/app/loads"
        style={{ fontSize: 11, color: "#9CA3AF", textDecoration: "none", fontWeight: 500 }}
      >
        Add load →
      </Link>
    </div>
  );
}

// ── Public export ──────────────────────────────────────────────────────────────

export function LoadContextCard({
  matchedLoad,
  classification,
}: {
  matchedLoad: Load | null;
  classification: Classification | null;
}) {
  if (matchedLoad) {
    const confidence = Math.round(Number(classification?.confidence ?? 0.85) * 100);
    return <MatchedLoadCard load={matchedLoad} confidence={confidence} />;
  }

  if (classification?.extractedLoadNumber) {
    return <UnmatchedLoadCard loadNumber={classification.extractedLoadNumber} />;
  }

  return null;
}
