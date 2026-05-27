"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { RiskBadge } from "@/components/RiskBadge";

type LoadRow = {
  id: string;
  loadNumber: string;
  poNumber: string | null;
  customerName: string | null;
  carrierName: string | null;
  originCity: string | null;
  originState: string | null;
  destinationCity: string | null;
  destinationState: string | null;
  pickupAt: Date | null;
  deliveryAt: Date | null;
  currentStatus: string | null;
  riskLevel: string | null;
  eta: Date | null;
  threadCount?: number;
  missingDocCount?: number;
};

const FILTERS = ["All", "At Risk", "In Transit", "Delivered", "Exception"] as const;
type Filter = (typeof FILTERS)[number];

function fmtDate(v: Date | null) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function lane(row: LoadRow) {
  const o = [row.originCity, row.originState].filter(Boolean).join(", ");
  const d = [row.destinationCity, row.destinationState].filter(Boolean).join(", ");
  return o && d ? `${o} → ${d}` : "—";
}

export function LoadsTableClient({ loads }: { loads: LoadRow[] }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("All");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return loads.filter((l) => {
      const status = (l.currentStatus ?? "").toLowerCase();
      const risk = (l.riskLevel ?? "low").toLowerCase();

      const passFilter =
        filter === "All" ||
        (filter === "At Risk"    && (risk === "high" || risk === "critical")) ||
        (filter === "In Transit" && status === "in transit") ||
        (filter === "Delivered"  && status.includes("delivered")) ||
        (filter === "Exception"  && status === "exception");

      if (!passFilter) return false;
      if (!q) return true;
      return [l.loadNumber, l.poNumber ?? "", l.customerName ?? "", l.carrierName ?? ""].some(
        (x) => x.toLowerCase().includes(q),
      );
    });
  }, [loads, search, filter]);

  return (
    <div>
      {/* Controls */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ position: "relative" }}>
          <svg
            width="12" height="12"
            viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round"
            style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search loads, customers, carriers…"
            style={{
              background: "#FFFFFF",
              border: "1px solid #E8E8E8",
              color: "#292929",
              borderRadius: 6,
              height: 34,
              padding: "0 12px 0 30px",
              width: 300,
              maxWidth: "100%",
              outline: "none",
              fontSize: 12,
            }}
          />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                border: `1px solid ${filter === f ? "#BFDBFE" : "#E8E8E8"}`,
                background: filter === f ? "#EFF6FF" : "#FFFFFF",
                color: filter === f ? "#2563EB" : "#7F7F7F",
                borderRadius: 20,
                padding: "4px 11px",
                fontSize: 11,
                fontWeight: filter === f ? 600 : 400,
                cursor: "pointer",
              }}
            >
              {f}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 11, color: "#9CA3AF", marginLeft: "auto" }}>
          {filtered.length} of {loads.length} loads
        </span>
      </div>

      {/* Table */}
      <div style={{ border: "1px solid #E8E8E8", borderRadius: 8, overflow: "hidden", background: "#FFFFFF" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#FAFAF8" }}>
              {["Load #", "PO #", "Customer", "Carrier", "Lane", "Pickup", "Delivery", "Status", "Risk", "ETA"].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: "left",
                    color: "#9CA3AF",
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.6px",
                    padding: "9px 12px",
                    borderBottom: "1px solid #F2F2F2",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => (
              <tr key={l.id} style={{ borderBottom: "1px solid #F2F2F2" }}>
                <td style={{ padding: "10px 12px" }}>
                  <Link href={`/app/loads/${l.id}`} style={{ color: "#2563EB", textDecoration: "none", fontWeight: 700, fontSize: 12, fontFamily: "monospace" }}>
                    {l.loadNumber}
                  </Link>
                </td>
                <td style={{ padding: "10px 12px", color: "#9CA3AF", fontSize: 11, fontFamily: "monospace" }}>
                  {l.poNumber ?? "—"}
                </td>
                <td style={{ padding: "10px 12px", color: "#292929", fontSize: 12 }}>{l.customerName ?? "—"}</td>
                <td style={{ padding: "10px 12px", color: "#5D5D5D", fontSize: 12 }}>{l.carrierName ?? "—"}</td>
                <td style={{ padding: "10px 12px", color: "#7F7F7F", fontSize: 11, whiteSpace: "nowrap" }}>{lane(l)}</td>
                <td style={{ padding: "10px 12px", color: "#7F7F7F", fontSize: 11, whiteSpace: "nowrap" }}>{fmtDate(l.pickupAt)}</td>
                <td style={{ padding: "10px 12px", color: "#7F7F7F", fontSize: 11, whiteSpace: "nowrap" }}>{fmtDate(l.deliveryAt)}</td>
                <td style={{ padding: "10px 12px" }}><StatusBadge status={l.currentStatus ?? "Unknown"} /></td>
                <td style={{ padding: "10px 12px" }}><RiskBadge level={l.riskLevel ?? "low"} /></td>
                <td style={{ padding: "10px 12px", color: l.eta && new Date(l.eta) < new Date() ? "#DC2626" : "#7F7F7F", fontSize: 11, whiteSpace: "nowrap" }}>
                  {fmtDate(l.eta)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", color: "#9CA3AF", fontSize: 12 }}>
            No loads match your filter
          </div>
        )}
      </div>
    </div>
  );
}
