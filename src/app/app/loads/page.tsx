import { getTenantIdForUser } from "@/lib/auth";
import Link from "next/link";
import { db } from "@/db";
import { loads, apiKeys } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { LoadsTableClient } from "./LoadsTableClient";

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
          🔗 <strong style={{ color: "#5D5D5D" }}>Read-only mirror</strong> — load data lives in your TMS. Clyde reads it to give AI replies context.
        </span>
        <span style={{ flex: 1 }} />
        {hasApiKey ? (
          <span style={{ fontSize: 11, color: "#16A34A", fontWeight: 600 }}>✓ API key active — push updates via POST /api/v1/loads</span>
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
              {allLoads.length} loads — context for AI email drafting
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
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
          </div>
        </div>
      </div>

      <LoadsTableClient loads={allLoads} />
    </div>
  );
}
