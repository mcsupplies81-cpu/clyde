import { db } from "@/db";
import { loads } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { LoadsTableClient } from "./LoadsTableClient";

export default async function LoadsPage() {
  const tenantId = process.env.DEMO_TENANT_ID ?? "";

  if (!tenantId) {
    return (
      <div style={{ padding: 40, color: "#f87171" }}>
        <strong>DEMO_TENANT_ID not set.</strong> Run <code>npm run db:seed</code> and add the tenant ID to <code>.env.local</code>.
      </div>
    );
  }

  const allLoads = await db.query.loads.findMany({
    where: eq(loads.tenantId, tenantId),
    orderBy: [desc(loads.pickupAt)],
  });

  return (
    <div style={{ padding: 24, background: "#0f1419", minHeight: "100%" }}>
      <div style={{ marginBottom: 14 }}>
        <h1 style={{ margin: 0, color: "#d6e0eb", fontSize: 22 }}>Loads</h1>
        <div style={{ color: "#7f92a8", fontSize: 13, marginTop: 6 }}>Track active shipments, exceptions, and customer load status.</div>
      </div>
      <LoadsTableClient loads={allLoads} />
    </div>
  );
}
