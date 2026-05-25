import { db } from "@/db";
import { loads } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { LoadsTableClient } from "./LoadsTableClient";

export default async function LoadsPage() {
  const tenantId = process.env.DEMO_TENANT_ID ?? "";

  if (!tenantId) {
    return (
      <div style={{ padding: 40, color: "#DC2626" }}>
        <strong>DEMO_TENANT_ID not set.</strong> Run <code>npm run db:seed</code>.
      </div>
    );
  }

  const allLoads = await db.query.loads.findMany({
    where: eq(loads.tenantId, tenantId),
    orderBy: [desc(loads.pickupAt)],
  });

  const atRisk     = allLoads.filter((l) => l.riskLevel === "high" || l.riskLevel === "critical").length;
  const exceptions = allLoads.filter((l) => l.currentStatus?.toLowerCase() === "exception").length;
  const inTransit  = allLoads.filter((l) => l.currentStatus?.toLowerCase() === "in transit").length;

  return (
    <div style={{ padding: 24, background: "#FAFAF8", minHeight: "100%" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ margin: 0, color: "#292929", fontSize: 18, fontWeight: 700, letterSpacing: "-0.5px" }}>
              Active Loads
            </h1>
            <div style={{ color: "#9CA3AF", fontSize: 12, marginTop: 4 }}>
              Shipment tracking and communication context for {allLoads.length} loads
            </div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            {[
              { label: "At Risk",     value: atRisk,     color: "#EA580C" },
              { label: "Exceptions",  value: exceptions,  color: "#DC2626" },
              { label: "In Transit",  value: inTransit,   color: "#2563EB" },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                style={{
                  padding: "8px 16px",
                  background: "#FFFFFF",
                  border: "1px solid #E8E8E8",
                  borderTop: `3px solid ${color}`,
                  borderRadius: 6,
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 18, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <LoadsTableClient loads={allLoads} />
    </div>
  );
}
