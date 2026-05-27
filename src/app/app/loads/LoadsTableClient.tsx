"use client";

import Link from "next/link";
import { useMemo, useState, useEffect, useRef } from "react";
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

const RISK_OPTIONS = [
  { label: "Any risk",    value: "all" },
  { label: "🔥 Critical", value: "critical" },
  { label: "High",        value: "high" },
  { label: "Medium",      value: "medium" },
  { label: "Low",         value: "low" },
] as const;
type RiskFilter = (typeof RISK_OPTIONS)[number]["value"];

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
  const [filterOpen, setFilterOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Unique sorted customer list
  const customers = useMemo(() => {
    return [...new Set(loads.map((l) => l.customerName).filter(Boolean) as string[])].sort();
  }, [loads]);

  // Close panel when clicking outside
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    }
    if (filterOpen) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [filterOpen]);

  const activeFilterCount =
    (riskFilter !== "all" ? 1 : 0) +
    (customerFilter !== "all" ? 1 : 0);

  function clearAdvanced() {
    setRiskFilter("all");
    setCustomerFilter("all");
    setFilterOpen(false);
  }

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

      const passRisk     = riskFilter === "all" || risk === riskFilter;
      const passCustomer = customerFilter === "all" || l.customerName === customerFilter;

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
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>

        {/* Search */}
        <div style={{ position: "relative" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round"
            style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search loads, customers, carriers…"
            style={{
              background: "#FFFFFF", border: "1px solid #E8E8E8", color: "#292929",
              borderRadius: 6, height: 34, padding: "0 12px 0 30px",
              width: 280, maxWidth: "100%", outline: "none", fontSize: 12,
            }}
          />
        </div>

        {/* Status chips */}
        <div style={{ display: "flex", gap: 4 }}>
          {STATUS_FILTERS.map((f) => (
            <button key={f} onClick={() => setStatusFilter(f)} style={{
              border: `1px solid ${statusFilter === f ? "#BFDBFE" : "#E8E8E8"}`,
              background: statusFilter === f ? "#EFF6FF" : "#FFFFFF",
              color: statusFilter === f ? "#2563EB" : "#7F7F7F",
              borderRadius: 20, padding: "4px 11px",
              fontSize: 11, fontWeight: statusFilter === f ? 600 : 400, cursor: "pointer",
            }}>
              {f}
            </button>
          ))}
        </div>

        {/* Advanced filters button */}
        <div style={{ position: "relative" }} ref={panelRef}>
          <button
            type="button"
            onClick={() => setFilterOpen((o) => !o)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              border: `1px solid ${activeFilterCount > 0 ? "#BFDBFE" : "#E8E8E8"}`,
              background: activeFilterCount > 0 ? "#EFF6FF" : "#FFFFFF",
              color: activeFilterCount > 0 ? "#2563EB" : "#6B7280",
              borderRadius: 6, height: 34, padding: "0 12px",
              fontSize: 12, fontWeight: activeFilterCount > 0 ? 600 : 400,
              cursor: "pointer",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="4" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="11" y1="18" x2="13" y2="18" />
            </svg>
            Filters
            {activeFilterCount > 0 && (
              <span style={{
                background: "#2563EB", color: "#FFFFFF",
                borderRadius: "50%", width: 16, height: 16,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontSize: 9, fontWeight: 700,
              }}>
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Dropdown panel */}
          {filterOpen && (
            <div style={{
              position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 50,
              background: "#FFFFFF", border: "1px solid #E8E8E8",
              borderRadius: 10, boxShadow: "0 4px 20px rgba(0,0,0,0.10)",
              padding: 16, minWidth: 260,
            }}>

              {/* Customer */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
                  Customer
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 160, overflowY: "auto" }}>
                  <button
                    type="button"
                    onClick={() => setCustomerFilter("all")}
                    style={{
                      textAlign: "left", background: customerFilter === "all" ? "#EFF6FF" : "none",
                      border: "none", borderRadius: 5, padding: "5px 8px",
                      fontSize: 12, color: customerFilter === "all" ? "#2563EB" : "#374151",
                      fontWeight: customerFilter === "all" ? 600 : 400, cursor: "pointer",
                    }}
                  >
                    All customers
                  </button>
                  {customers.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCustomerFilter(c)}
                      style={{
                        textAlign: "left", background: customerFilter === c ? "#EFF6FF" : "none",
                        border: "none", borderRadius: 5, padding: "5px 8px",
                        fontSize: 12, color: customerFilter === c ? "#2563EB" : "#374151",
                        fontWeight: customerFilter === c ? 600 : 400, cursor: "pointer",
                      }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Risk / Temperature */}
              <div style={{ borderTop: "1px solid #F2F2F2", paddingTop: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
                  Risk / Temperature
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {RISK_OPTIONS.map(({ label, value }) => {
                    const active = riskFilter === value;
                    const isCritical = value === "critical";
                    const isHigh     = value === "high";
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setRiskFilter(value)}
                        style={{
                          border: `1px solid ${active ? (isCritical ? "#FECACA" : isHigh ? "#FED7AA" : "#BFDBFE") : "#E8E8E8"}`,
                          background: active ? (isCritical ? "#FEF2F2" : isHigh ? "#FFF7ED" : "#EFF6FF") : "#FAFAFA",
                          color: active ? (isCritical ? "#DC2626" : isHigh ? "#EA580C" : "#2563EB") : "#6B7280",
                          borderRadius: 20, padding: "4px 11px",
                          fontSize: 11, fontWeight: active ? 600 : 400, cursor: "pointer",
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Footer */}
              {activeFilterCount > 0 && (
                <div style={{ borderTop: "1px solid #F2F2F2", paddingTop: 10, marginTop: 14 }}>
                  <button
                    type="button"
                    onClick={clearAdvanced}
                    style={{
                      fontSize: 11, color: "#DC2626", background: "none", border: "none",
                      cursor: "pointer", padding: 0, fontWeight: 600,
                    }}
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </div>
          )}
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
                <th key={h} style={{
                  textAlign: "left", color: "#9CA3AF", fontSize: 10, fontWeight: 700,
                  textTransform: "uppercase", letterSpacing: "0.6px",
                  padding: "9px 12px", borderBottom: "1px solid #F2F2F2", whiteSpace: "nowrap",
                }}>
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
                <td style={{ padding: "10px 12px", color: "#9CA3AF", fontSize: 11, fontFamily: "monospace" }}>{l.poNumber ?? "—"}</td>
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
