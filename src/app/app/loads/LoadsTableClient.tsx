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

const STATUS_FILTERS = ["All", "In Transit", "Delivered", "Exception"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const RISK_FILTERS = [
  { label: "All",       value: "all" },
  { label: "🔥 Critical", value: "critical" },
  { label: "High",      value: "high" },
  { label: "Medium",    value: "medium" },
  { label: "Low",       value: "low" },
] as const;
type RiskFilter = (typeof RISK_FILTERS)[number]["value"];

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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [customerFilter, setCustomerFilter] = useState<string>("all");

  // Unique sorted customer list
  const customers = useMemo(() => {
    const names = [...new Set(loads.map((l) => l.customerName).filter(Boolean) as string[])].sort();
    return names;
  }, [loads]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return loads.filter((l) => {
      const status = (l.currentStatus ?? "").toLowerCase();
      const risk   = (l.riskLevel ?? "low").toLowerCase();

      const passStatus =
        statusFilter === "All" ||
        (statusFilter === "In Transit" && status === "in transit") ||
        (statusFilter === "Delivered"  && status.includes("delivered")) ||
        (statusFilter === "Exception"  && status === "exception");

      const passRisk =
        riskFilter === "all" || risk === riskFilter;

      const passCustomer =
        customerFilter === "all" || l.customerName === customerFilter;

      if (!passStatus || !passRisk || !passCustomer) return false;
      if (!q) return true;
      return [l.loadNumber, l.poNumber ?? "", l.customerName ?? "", l.carrierName ?? ""].some(
        (x) => x.toLowerCase().includes(q),
      );
    });
  }, [loads, search, statusFilter, riskFilter, customerFilter]);

  return (
    <div>
      {/* Controls */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
        {/* Row 1: search + customer */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
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
                width: 260,
                maxWidth: "100%",
                outline: "none",
                fontSize: 12,
              }}
            />
          </div>

          {/* Customer dropdown */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px" }}>Customer</span>
            <select
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              style={{
                background: customerFilter !== "all" ? "#EFF6FF" : "#FFFFFF",
                border: `1px solid ${customerFilter !== "all" ? "#BFDBFE" : "#E8E8E8"}`,
                color: customerFilter !== "all" ? "#2563EB" : "#5D5D5D",
                borderRadius: 6,
                height: 34,
                padding: "0 28px 0 10px",
                fontSize: 12,
                outline: "none",
                cursor: "pointer",
                fontWeight: customerFilter !== "all" ? 600 : 400,
                appearance: "none",
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%239CA3AF' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 8px center",
                minWidth: 140,
              }}
            >
              <option value="all">All customers</option>
              {customers.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {customerFilter !== "all" && (
              <button
                type="button"
                onClick={() => setCustomerFilter("all")}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", fontSize: 14, padding: "0 2px", lineHeight: 1 }}
                title="Clear customer filter"
              >
                ✕
              </button>
            )}
          </div>

          <span style={{ fontSize: 11, color: "#9CA3AF", marginLeft: "auto" }}>
            {filtered.length} of {loads.length} loads
          </span>
        </div>

        {/* Row 2: status + risk chips */}
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          {/* Status chips */}
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "#C4C4C4", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px", marginRight: 2 }}>Status</span>
            {STATUS_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                style={{
                  border: `1px solid ${statusFilter === f ? "#BFDBFE" : "#E8E8E8"}`,
                  background: statusFilter === f ? "#EFF6FF" : "#FFFFFF",
                  color: statusFilter === f ? "#2563EB" : "#7F7F7F",
                  borderRadius: 20,
                  padding: "3px 10px",
                  fontSize: 11,
                  fontWeight: statusFilter === f ? 600 : 400,
                  cursor: "pointer",
                }}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 18, background: "#E8E8E8" }} />

          {/* Risk / Temperature chips */}
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "#C4C4C4", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px", marginRight: 2 }}>Risk</span>
            {RISK_FILTERS.map(({ label, value }) => {
              const active = riskFilter === value;
              const isCritical = value === "critical";
              const isHigh     = value === "high";
              return (
                <button
                  key={value}
                  onClick={() => setRiskFilter(value)}
                  style={{
                    border: `1px solid ${active ? (isCritical ? "#FECACA" : isHigh ? "#FED7AA" : "#BFDBFE") : "#E8E8E8"}`,
                    background: active ? (isCritical ? "#FEF2F2" : isHigh ? "#FFF7ED" : "#EFF6FF") : "#FFFFFF",
                    color: active ? (isCritical ? "#DC2626" : isHigh ? "#EA580C" : "#2563EB") : "#7F7F7F",
                    borderRadius: 20,
                    padding: "3px 10px",
                    fontSize: 11,
                    fontWeight: active ? 600 : 400,
                    cursor: "pointer",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
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
