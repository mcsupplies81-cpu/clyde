import { db } from "@/db";
import { aiClassifications, aiDrafts, auditLogs, emailMessages, emailThreads, loads } from "@/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";

type CountRow = { label: string; count: number };

const BAR_COLORS = ["#60a5fa", "#34d399", "#f59e0b", "#a78bfa", "#f472b6", "#22d3ee"];

function toPercent(value: number, total: number) {
  if (!total) return 0;
  return Math.max(4, Math.round((value / total) * 100));
}

function normalizeRows(rows: Array<{ label: string | null; count: number }>): CountRow[] {
  return rows
    .map((row) => ({ label: row.label?.trim() || "unassigned", count: Number(row.count) || 0 }))
    .sort((a, b) => b.count - a.count);
}

function BreakdownCard({ title, rows }: { title: string; rows: CountRow[] }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);

  return (
    <section style={{ background: "#141c24", border: "1px solid #1e2d3d", borderRadius: 10, padding: 16 }}>
      <h3 style={{ margin: "0 0 14px", fontSize: 13, color: "#d6e0eb", fontWeight: 600 }}>{title}</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.length ? rows.map((row, idx) => (
          <div key={row.label}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: "#a8bdd4", textTransform: "capitalize" }}>{row.label.replaceAll("_", " ")}</span>
              <span style={{ color: "#7f92a8" }}>{row.count}</span>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: "#1f2d3d", overflow: "hidden" }}>
              <div style={{ width: `${toPercent(row.count, total)}%`, height: "100%", background: BAR_COLORS[idx % BAR_COLORS.length] }} />
            </div>
          </div>
        )) : <div style={{ fontSize: 12, color: "#4a5e75" }}>No data yet</div>}
      </div>
    </section>
  );
}

function MetricCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div style={{ background: "#141c24", border: "1px solid #1e2d3d", borderRadius: 10, padding: 16, borderTop: `3px solid ${accent}` }}>
      <div style={{ fontSize: 26, fontWeight: 700, color: "#e2ebf5", lineHeight: 1.1 }}>{value.toLocaleString()}</div>
      <div style={{ marginTop: 8, color: "#7f92a8", fontSize: 12 }}>{label}</div>
    </div>
  );
}

export default async function AnalyticsPage() {
  const tenantId = process.env.DEMO_TENANT_ID ?? "";

  if (!tenantId) {
    return (
      <div style={{ padding: 40, color: "#f87171" }}>
        <strong>DEMO_TENANT_ID not set.</strong> Run <code>npm run db:seed</code> and add the tenant ID to <code>.env.local</code>.
      </div>
    );
  }

  const [
    inboundEmails,
    classifiedEmails,
    draftsGenerated,
    draftsApproved,
    openThreads,
    escalatedThreads,
    categoriesRaw,
    priorityRaw,
    riskRaw,
    recentActivity,
  ] = await Promise.all([
    db.$count(emailMessages, and(eq(emailMessages.tenantId, tenantId), eq(emailMessages.direction, "inbound"))),
    db.$count(aiClassifications, eq(aiClassifications.tenantId, tenantId)),
    db.$count(aiDrafts, eq(aiDrafts.tenantId, tenantId)),
    db.$count(aiDrafts, and(eq(aiDrafts.tenantId, tenantId), eq(aiDrafts.status, "approved"))),
    db.$count(emailThreads, and(eq(emailThreads.tenantId, tenantId), eq(emailThreads.status, "open"))),
    db.$count(emailThreads, and(eq(emailThreads.tenantId, tenantId), eq(emailThreads.status, "escalated"))),
    db.select({ label: aiClassifications.category, count: sql<number>`count(*)::int` }).from(aiClassifications).where(eq(aiClassifications.tenantId, tenantId)).groupBy(aiClassifications.category),
    db.select({ label: emailThreads.priority, count: sql<number>`count(*)::int` }).from(emailThreads).where(eq(emailThreads.tenantId, tenantId)).groupBy(emailThreads.priority),
    db.select({ label: loads.riskLevel, count: sql<number>`count(*)::int` }).from(loads).where(eq(loads.tenantId, tenantId)).groupBy(loads.riskLevel),
    db.query.auditLogs.findMany({
      where: eq(auditLogs.tenantId, tenantId),
      orderBy: [desc(auditLogs.createdAt)],
      limit: 10,
      columns: { id: true, actorName: true, action: true, entityType: true, createdAt: true },
    }),
  ]);

  const categories = normalizeRows(categoriesRaw);
  const priorities = normalizeRows(priorityRaw);
  const risks = normalizeRows(riskRaw);

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ margin: 0, color: "#e2ebf5", fontSize: 20 }}>Analytics</h1>
        <span style={{ color: "#4a5e75", fontSize: 12 }}>Tenant: {tenantId.slice(0, 8)}…</span>
      </div>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 12 }}>
        <MetricCard label="Total inbound emails" value={inboundEmails} accent="#60a5fa" />
        <MetricCard label="Emails classified" value={classifiedEmails} accent="#34d399" />
        <MetricCard label="Drafts generated" value={draftsGenerated} accent="#f59e0b" />
        <MetricCard label="Drafts approved" value={draftsApproved} accent="#22d3ee" />
        <MetricCard label="Open threads" value={openThreads} accent="#a78bfa" />
        <MetricCard label="Escalated threads" value={escalatedThreads} accent="#f472b6" />
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
        <BreakdownCard title="Emails by category" rows={categories} />
        <BreakdownCard title="Threads by priority" rows={priorities} />
        <BreakdownCard title="Loads by risk level" rows={risks} />
      </section>

      <section style={{ background: "#141c24", border: "1px solid #1e2d3d", borderRadius: 10, padding: 16 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 13, color: "#d6e0eb", fontWeight: 600 }}>Recent activity</h3>
        {recentActivity.length ? (
          <div style={{ display: "grid", gap: 8 }}>
            {recentActivity.map((entry) => (
              <div key={entry.id} style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr auto", gap: 8, borderBottom: "1px solid #1b2530", paddingBottom: 8, fontSize: 12 }}>
                <span style={{ color: "#a8bdd4" }}>{entry.actorName}</span>
                <span style={{ color: "#60a5fa", textTransform: "capitalize" }}>{entry.action.replaceAll("_", " ")}</span>
                <span style={{ color: "#7f92a8", textTransform: "capitalize" }}>{entry.entityType.replaceAll("_", " ")}</span>
                <span style={{ color: "#4a5e75" }}>{new Date(entry.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "#4a5e75" }}>No activity logged yet</div>
        )}
      </section>
    </div>
  );
}
