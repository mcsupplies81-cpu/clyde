import { db } from "@/db";
import { emailThreads, loadDocuments, loads } from "@/db/schema";
import { StatusBadge } from "@/components/StatusBadge";
import { RiskBadge } from "@/components/RiskBadge";
import { and, desc, eq } from "drizzle-orm";

function fmtDateTime(v: Date | null) {
  return v ? new Date(v).toLocaleString() : "—";
}

function fmtCurrency(v: string | null) {
  if (!v) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(v));
}

export default async function LoadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenantId = process.env.DEMO_TENANT_ID ?? "";

  if (!tenantId) {
    return <div style={{ padding: 40, color: "#f87171" }}>DEMO_TENANT_ID not set.</div>;
  }

  const load = await db.query.loads.findFirst({
    where: and(eq(loads.id, id), eq(loads.tenantId, tenantId)),
  });

  if (!load) {
    return <div style={{ padding: 24, color: "#7f92a8" }}>Load not found.</div>;
  }

  const docs = await db.query.loadDocuments.findMany({
    where: and(eq(loadDocuments.loadId, load.id), eq(loadDocuments.tenantId, tenantId)),
    orderBy: [desc(loadDocuments.createdAt)],
  });

  const threads = load.customerName
    ? await db.query.emailThreads.findMany({
        where: and(eq(emailThreads.tenantId, tenantId), eq(emailThreads.customerName, load.customerName)),
        orderBy: [desc(emailThreads.lastMessageAt)],
      })
    : [];

  return (
    <div style={{ padding: 24, background: "#0f1419", minHeight: "100%" }}>
      <div style={{ marginBottom: 18 }}>
        <a href="/app/loads" style={{ color: "#7f92a8", fontSize: 12, textDecoration: "none" }}>← Back to loads</a>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
          <h1 style={{ margin: 0, fontSize: 24, color: "#d6e0eb" }}>{load.loadNumber}</h1>
          <StatusBadge status={load.currentStatus ?? "Unknown"} />
          <RiskBadge level={load.riskLevel ?? "low"} />
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 6, color: "#a8bdd4", fontSize: 13 }}>
          <span>Customer: {load.customerName ?? "—"}</span>
          <span>Carrier: {load.carrierName ?? "—"}</span>
        </div>
      </div>

      <div style={{ display: "grid", gap: 14 }}>
        <section style={{ background: "#141c24", border: "1px solid #1e2d3d", borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 11, color: "#7f92a8", textTransform: "uppercase", marginBottom: 10 }}>Route</div>
          <div style={{ color: "#d6e0eb", fontSize: 16, marginBottom: 12 }}>
            {[load.originCity, load.originState].filter(Boolean).join(", ") || "Unknown"} → {[load.destinationCity, load.destinationState].filter(Boolean).join(", ") || "Unknown"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
            <div><div style={{ color: "#7f92a8", fontSize: 12 }}>Pickup</div><div style={{ color: "#a8bdd4" }}>{fmtDateTime(load.pickupAt)}</div></div>
            <div><div style={{ color: "#7f92a8", fontSize: 12 }}>Delivery</div><div style={{ color: "#a8bdd4" }}>{fmtDateTime(load.deliveryAt)}</div></div>
            <div><div style={{ color: "#7f92a8", fontSize: 12 }}>ETA</div><div style={{ color: "#a8bdd4" }}>{fmtDateTime(load.eta)}</div></div>
          </div>
        </section>

        <section style={{ background: "#141c24", border: "1px solid #1e2d3d", borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 11, color: "#7f92a8", textTransform: "uppercase", marginBottom: 10 }}>Load Details</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
            <div><div style={{ color: "#7f92a8", fontSize: 12 }}>Driver Name</div><div style={{ color: "#a8bdd4" }}>{load.driverName ?? "—"}</div></div>
            <div><div style={{ color: "#7f92a8", fontSize: 12 }}>Driver Phone</div><div style={{ color: "#a8bdd4" }}>{load.driverPhone ?? "—"}</div></div>
            <div><div style={{ color: "#7f92a8", fontSize: 12 }}>Equipment</div><div style={{ color: "#a8bdd4" }}>{load.equipmentType ?? "—"}</div></div>
            <div><div style={{ color: "#7f92a8", fontSize: 12 }}>Rate</div><div style={{ color: "#a8bdd4" }}>{fmtCurrency(load.rate)}</div></div>
          </div>
          {load.internalNotes && (
            <div style={{ marginTop: 14, background: "#1f2d3d", border: "1px solid #253347", borderRadius: 6, padding: 12 }}>
              <div style={{ color: "#7f92a8", fontSize: 11, textTransform: "uppercase", marginBottom: 6 }}>Internal Notes</div>
              <div style={{ color: "#a8bdd4", whiteSpace: "pre-wrap" }}>{load.internalNotes}</div>
            </div>
          )}
        </section>

        <section style={{ background: "#141c24", border: "1px solid #1e2d3d", borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 11, color: "#7f92a8", textTransform: "uppercase", marginBottom: 10 }}>Documents</div>
          {docs.length === 0 ? (
            <div style={{ color: "#7f92a8" }}>No documents uploaded.</div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {docs.map((d) => (
                <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #1e2d3d", borderRadius: 6, padding: "8px 10px" }}>
                  <div>
                    <div style={{ color: "#d6e0eb", fontSize: 13 }}>{d.documentType}</div>
                    <div style={{ color: "#7f92a8", fontSize: 12 }}>{d.fileName}</div>
                  </div>
                  <a href="#" style={{ color: "#60a5fa", textDecoration: "none", fontSize: 12 }}>Download</a>
                </div>
              ))}
            </div>
          )}
        </section>

        <section style={{ background: "#141c24", border: "1px solid #1e2d3d", borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 11, color: "#7f92a8", textTransform: "uppercase", marginBottom: 10 }}>Related Threads</div>
          {threads.length === 0 ? <div style={{ color: "#7f92a8" }}>No related threads.</div> : (
            <div style={{ display: "grid", gap: 8 }}>
              {threads.map((t) => (
                <a key={t.id} href={`/app/inbox?threadId=${t.id}`} style={{ display: "block", border: "1px solid #1e2d3d", borderRadius: 6, padding: "10px 12px", textDecoration: "none", background: "#101922" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
                    <div style={{ color: "#d6e0eb", fontSize: 13 }}>{t.subject}</div>
                    <StatusBadge status={t.status} />
                  </div>
                  <div style={{ color: "#7f92a8", fontSize: 12 }}>Last Message: {fmtDateTime(t.lastMessageAt)}</div>
                </a>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
