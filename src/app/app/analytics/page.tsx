import { db } from "@/db";
import { aiClassifications, aiDrafts, auditLogs, emailMessages, emailThreads, loads } from "@/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";

type CountRow = { label: string; count: number };

const BAR_COLORS = ["#2563EB", "#16A34A", "#D97706", "#7C3AED", "#EA580C", "#0284C7"];

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
    <section style={{ background: "#FFFFFF", border: "1px solid #E8E8E8", borderRadius: 10, padding: 16 }}>
      <h3 style={{ margin: "0 0 14px", fontSize: 13, color: "#292929", fontWeight: 600 }}>{title}</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.length ? rows.map((row, idx) => (
          <div key={row.label}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: "#5D5D5D", textTransform: "capitalize" }}>{row.label.replaceAll("_", " ")}</span>
              <span style={{ color: "#9CA3AF" }}>{row.count}</span>
            </div>
            <div style={{ height: 6, borderRadius: 999, background: "#F2F2F2", overflow: "hidden" }}>
              <div style={{ width: `${toPercent(row.count, total)}%`, height: "100%", background: BAR_COLORS[idx % BAR_COLORS.length], borderRadius: 999 }} />
            </div>
          </div>
        )) : <div style={{ fontSize: 12, color: "#9CA3AF" }}>No data yet</div>}
      </div>
    </section>
  );
}

function MetricCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div style={{ background: "#FFFFFF", border: "1px solid #E8E8E8", borderRadius: 10, padding: 16, borderTop: `3px solid ${accent}` }}>
      <div style={{ fontSize: 26, fontWeight: 700, color: "#292929", lineHeight: 1.1 }}>{value.toLocaleString()}</div>
      <div style={{ marginTop: 8, color: "#7F7F7F", fontSize: 12 }}>{label}</div>
    </div>
  );
}

export default async function AnalyticsPage() {
  const tenantId = process.env.DEMO_TENANT_ID ?? "";

  if (!tenantId) {
    return (
      <div style={{ padding: 40, color: "#DC2626" }}>
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
  const risks      = normalizeRows(riskRaw);

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16, background: "#FAFAF8", minHeight: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ margin: 0, color: "#292929", fontSize: 20, fontWeight: 700 }}>Analytics</h1>
        <span style={{ color: "#9CA3AF", fontSize: 12 }}>Tenant: {tenantId.slice(0, 8)}…</span>
      </div>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 12 }}>
        <MetricCard label="Total inbound emails" value={inboundEmails}    accent="#2563EB" />
        <MetricCard label="Emails classified"    value={classifiedEmails} accent="#16A34A" />
        <MetricCard label="Drafts generated"     value={draftsGenerated}  accent="#D97706" />
        <MetricCard label="Drafts approved"      value={draftsApproved}   accent="#0284C7" />
        <MetricCard label="Open threads"         value={openThreads}      accent="#7C3AED" />
        <MetricCard label="Escalated threads"    value={escalatedThreads} accent="#DC2626" />
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
        <BreakdownCard title="Emails by category"   rows={categories} />
        <BreakdownCard title="Threads by priority"  rows={priorities} />
        <BreakdownCard title="Loads by risk level"  rows={risks} />
      </section>

      <section style={{ background: "#FFFFFF", border: "1px solid #E8E8E8", borderRadius: 10, padding: 16 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 13, color: "#292929", fontWeight: 600 }}>Recent activity</h3>
        {recentActivity.length ? (
          <div style={{ display: "grid", gap: 8 }}>
            {recentActivity.map((entry) => (
              <div key={entry.id} style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr auto", gap: 8, borderBottom: "1px solid #F2F2F2", paddingBottom: 8, fontSize: 12 }}>
                <span style={{ color: "#292929" }}>{entry.actorName}</span>
                <span style={{ color: "#2563EB", textTransform: "capitalize" }}>{entry.action.replaceAll("_", " ")}</span>
                <span style={{ color: "#7F7F7F", textTransform: "capitalize" }}>{entry.entityType.replaceAll("_", " ")}</span>
                <span style={{ color: "#9CA3AF" }}>{new Date(entry.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "#9CA3AF" }}>No activity logged yet</div>
        )}
      </section>
    </div>
  );
}
