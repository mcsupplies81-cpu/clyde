import { getTenantIdForUser } from "@/lib/auth";
import Link from "next/link";
import { db } from "@/db";
import { loads, apiKeys } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { LoadsTableClient } from "./LoadsTableClient";
import { AddLoadModal } from "./AddLoadModal";
import { addLoadAction, exportLoadsAction } from "./actions";

export default async function LoadsPage() {
  const tenantId = await getTenantIdForUser();

  if (!tenantId) {
    return (
      <div style={{ padding: 40, color: "#DC2626" }}>
        <strong>DEMO_TENANT_ID not set.</strong> Run <code>npm run db:seed</code>.
      </div>
    );
  }

  const [allLoads, hasApiKey] = await Promise.all([
    db.query.loads.findMany({ where: eq(loads.tenantId, tenantId), orderBy: [desc(loads.pickupAt)] }),
    db.query.apiKeys.findFirst({ where: and(eq(apiKeys.tenantId, tenantId), eq(apiKeys.isActive, true)) }),
  ]);

  const atRisk     = allLoads.filter((l) => l.riskLevel === "high" || l.riskLevel === "critical").length;
  const exceptions = allLoads.filter((l) => l.currentStatus?.toLowerCase() === "exception").length;
  const inTransit  = allLoads.filter((l) => ["in_transit", "in transit"].includes((l.currentStatus ?? "").toLowerCase())).length;

  return (
    <div style={{ padding: 24, background: "#FAFAF8", minHeight: "100%" }}>
      {/* TMS mirror banner */}
      <div style={{
        marginBottom: 16,
        padding: "9px 14px",
        background: "#FFFFFF",
        border: "1px solid #EBEBEB",
        borderRadius: 8,
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap" as const,
      }}>
        <span style={{ fontSize: 11, color: "#9CA3AF" }}>
          🔗 <strong style={{ color: "#5D5D5D" }}>TMS sync</strong> — push load updates via API, or add loads manually below.
        </span>
        <span style={{ flex: 1 }} />
        {hasApiKey ? (
          <span style={{ fontSize: 11, color: "#16A34A", fontWeight: 600 }}>✓ API key active — POST /api/v1/loads</span>
        ) : (
          <Link href="/app/settings" style={{ fontSize: 11, color: "#2563EB", fontWeight: 600, textDecoration: "none" }}>
            Generate API key to sync from TMS →
          </Link>
        )}
      </div>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ margin: 0, color: "#292929", fontSize: 18, fontWeight: 700, letterSpacing: "-0.5px" }}>
              Active Loads
            </h1>
            <div style={{ color: "#9CA3AF", fontSize: 12, marginTop: 4 }}>
              {allLoads.length} load{allLoads.length !== 1 ? "s" : ""} · AI uses this data to draft replies
            </div>
          </div>

          {/* Right: stats + action buttons */}
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" as const }}>
            {[
              { label: "At Risk",    value: atRisk,     color: "#EA580C" },
              { label: "Exception",  value: exceptions,  color: "#DC2626" },
              { label: "In Transit", value: inTransit,   color: "#2563EB" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ padding: "8px 14px", background: "#FFFFFF", border: "1px solid #E8E8E8", borderTop: `3px solid ${color}`, borderRadius: 6, textAlign: "center" as const }}>
                <div style={{ fontSize: 18, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 4, textTransform: "uppercase" as const, letterSpacing: "0.5px" }}>{label}</div>
              </div>
            ))}

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 8, alignSelf: "center" }}>
              <ExportButton action={exportLoadsAction} count={allLoads.length} />
              <AddLoadModal action={addLoadAction} />
            </div>
          </div>
        </div>
      </div>

      <LoadsTableClient loads={allLoads} />
    </div>
  );
}

// ── CSV Export button (client component) ──────────────────────────────────────
function ExportButton({ action, count }: { action: () => Promise<string>; count: number }) {
  // Server-rendered anchor that triggers download — uses a separate API route
  if (count === 0) return null;
  return (
    <a
      href="/api/v1/loads/export"
      download="clyde-loads.csv"
      style={{
        background: "#FFFFFF",
        color: "#5D5D5D",
        border: "1px solid #E8E8E8",
        borderRadius: 7,
        padding: "8px 14px",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        textDecoration: "none",
        display: "inline-block",
      }}
    >
      ↓ Export CSV
    </a>
  );
}
