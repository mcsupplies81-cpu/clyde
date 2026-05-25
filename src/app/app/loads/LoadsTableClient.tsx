"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { RiskBadge } from "@/components/RiskBadge";

type LoadRow = {
  id: string;
  loadNumber: string;
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
};

const FILTERS = ["All", "At Risk", "In Transit", "Delivered", "Exception"] as const;
type Filter = (typeof FILTERS)[number];

function fmtDate(v: Date | null) {
  return v ? new Date(v).toLocaleDateString() : "—";
}

function lane(row: LoadRow) {
  const o = [row.originCity, row.originState].filter(Boolean).join(", ");
  const d = [row.destinationCity, row.destinationState].filter(Boolean).join(", ");
  return `${o || "Unknown"} → ${d || "Unknown"}`;
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
        (filter === "At Risk" && risk === "high") ||
        (filter === "In Transit" && status === "in transit") ||
        (filter === "Delivered" && status.includes("delivered")) ||
        (filter === "Exception" && status === "exception");

      if (!passFilter) return false;
      if (!q) return true;
      return [l.loadNumber, l.customerName ?? "", l.carrierName ?? ""].some((x) => x.toLowerCase().includes(q));
    });
  }, [loads, search, filter]);

  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by load #, customer, or carrier"
          style={{
            background: "#141c24",
            border: "1px solid #1e2d3d",
            color: "#d6e0eb",
            borderRadius: 6,
            height: 36,
            padding: "0 12px",
            width: 340,
            maxWidth: "100%",
            outline: "none",
          }}
        />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                border: `1px solid ${filter === f ? "#31567d" : "#1e2d3d"}`,
                background: filter === f ? "#1f2d3d" : "#141c24",
                color: filter === f ? "#d6e0eb" : "#7f92a8",
                borderRadius: 999,
                padding: "5px 10px",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div style={{ border: "1px solid #1e2d3d", borderRadius: 8, overflow: "hidden", background: "#141c24" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#101922" }}>
              {["Load #", "Customer", "Carrier", "Route", "Pickup", "Delivery", "Status", "Risk", "ETA"].map((h) => (
                <th key={h} style={{ textAlign: "left", color: "#7f92a8", fontSize: 11, fontWeight: 600, textTransform: "uppercase", padding: "10px 12px", borderBottom: "1px solid #1e2d3d" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => (
              <tr key={l.id} style={{ borderBottom: "1px solid #1e2d3d" }}>
                <td style={{ padding: 12 }}><Link href={`/app/loads/${l.id}`} style={{ color: "#60a5fa", textDecoration: "none", fontWeight: 600 }}>{l.loadNumber}</Link></td>
                <td style={{ padding: 12, color: "#d6e0eb" }}>{l.customerName ?? "—"}</td>
                <td style={{ padding: 12, color: "#a8bdd4" }}>{l.carrierName ?? "—"}</td>
                <td style={{ padding: 12, color: "#a8bdd4" }}>{lane(l)}</td>
                <td style={{ padding: 12, color: "#a8bdd4" }}>{fmtDate(l.pickupAt)}</td>
                <td style={{ padding: 12, color: "#a8bdd4" }}>{fmtDate(l.deliveryAt)}</td>
                <td style={{ padding: 12 }}><StatusBadge status={l.currentStatus ?? "Unknown"} /></td>
                <td style={{ padding: 12 }}><RiskBadge level={l.riskLevel ?? "low"} /></td>
                <td style={{ padding: 12, color: "#a8bdd4" }}>{fmtDate(l.eta)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div style={{ padding: 20, color: "#7f92a8" }}>No loads match your search/filter.</div>}
      </div>
    </div>
  );
}
