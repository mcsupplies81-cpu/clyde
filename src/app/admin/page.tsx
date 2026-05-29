import { isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { tenants, users, emailMessages, emailThreads, loads, inviteTokens } from "@/db/schema";
import { eq, desc, sql, and, isNull, gt } from "drizzle-orm";
import { NewPilotForm } from "./NewPilotForm";
import { TenantCard } from "./TenantCard";

export default async function AdminPage() {
  if (!await isAdmin()) redirect("/app/inbox");

  // ── Global stats ───────────────────────────────────────────────────────────
  const [
    allTenants,
    totalEmails,
    totalLoads,
    totalUsers,
  ] = await Promise.all([
    db.query.tenants.findMany({
      orderBy: [desc(tenants.createdAt)],
    }),
    db.$count(emailMessages),
    db.$count(loads),
    db.$count(users),
  ]);

  // ── Per-tenant stats ───────────────────────────────────────────────────────
  const tenantIds = allTenants.map((t) => t.id);

  const [emailCounts, loadCounts, userCounts, inviteCounts] = await Promise.all([
    db.select({ tenantId: emailMessages.tenantId, count: sql<number>`count(*)::int` })
      .from(emailMessages)
      .groupBy(emailMessages.tenantId),
    db.select({ tenantId: loads.tenantId, count: sql<number>`count(*)::int` })
      .from(loads)
      .groupBy(loads.tenantId),
    db.select({ tenantId: users.tenantId, count: sql<number>`count(*)::int` })
      .from(users)
      .groupBy(users.tenantId),
    // Active (unused, non-expired) invite tokens per tenant
    db.select({ tenantId: inviteTokens.tenantId, count: sql<number>`count(*)::int` })
      .from(inviteTokens)
      .where(and(isNull(inviteTokens.usedAt), gt(inviteTokens.expiresAt, new Date())))
      .groupBy(inviteTokens.tenantId),
  ]);

  const emailByTenant  = Object.fromEntries(emailCounts.map((r) => [r.tenantId, r.count]));
  const loadByTenant   = Object.fromEntries(loadCounts.map((r) => [r.tenantId, r.count]));
  const userByTenant   = Object.fromEntries(userCounts.map((r) => [r.tenantId, r.count]));
  const inviteByTenant = Object.fromEntries(inviteCounts.map((r) => [r.tenantId, r.count]));

  const activeTenants  = allTenants.filter((t) => t.status !== "churned" && t.plan !== "demo").length;
  const trialTenants   = allTenants.filter((t) => t.status === "trial").length;
  const paidTenants    = allTenants.filter((t) => t.plan === "paid").length;
  const totalSeats     = allTenants.reduce((s, t) => s + t.seatLimit, 0);

  return (
    <div style={{ minHeight: "100vh", background: "#0F172A", color: "#F8FAFC", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

      {/* Top bar */}
      <div style={{ borderBottom: "1px solid #1E293B", padding: "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: "-0.5px", color: "#2563EB" }}>CLYDE</span>
          <span style={{ fontSize: 11, color: "#64748B", fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase" }}>Admin</span>
        </div>
        <a href="/app/inbox" style={{ fontSize: 12, color: "#64748B", textDecoration: "none" }}>← Back to app</a>
      </div>

      <div style={{ padding: 28, maxWidth: 1200, margin: "0 auto" }}>

        {/* ── Stats row ─────────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginBottom: 32 }}>
          {[
            { label: "Total Accounts",    value: allTenants.length,   color: "#60A5FA" },
            { label: "Active Pilots",     value: activeTenants,       color: "#34D399" },
            { label: "On Trial",          value: trialTenants,        color: "#FBBF24" },
            { label: "Paid",              value: paidTenants,         color: "#A78BFA" },
            { label: "Total Emails",      value: totalEmails,         color: "#F472B6" },
            { label: "Total Seats Sold",  value: totalSeats,          color: "#FB923C" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: "#1E293B", borderRadius: 10, padding: "16px 18px", borderTop: `3px solid ${color}` }}>
              <div style={{ fontSize: 24, fontWeight: 700, color, lineHeight: 1 }}>{Number(value).toLocaleString()}</div>
              <div style={{ fontSize: 11, color: "#64748B", marginTop: 6, fontWeight: 500 }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 24, alignItems: "start" }}>

          {/* ── Tenant list ─────────────────────────────────────────────── */}
          <div>
            <h2 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 600, color: "#CBD5E1" }}>
              Accounts ({allTenants.length})
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {allTenants.map((tenant) => (
                <TenantCard
                  key={tenant.id}
                  tenant={tenant}
                  emails={emailByTenant[tenant.id] ?? 0}
                  loads={loadByTenant[tenant.id] ?? 0}
                  users={userByTenant[tenant.id] ?? 0}
                  pendingInvites={inviteByTenant[tenant.id] ?? 0}
                />
              ))}
              {allTenants.length === 0 && (
                <div style={{ padding: 32, textAlign: "center", color: "#475569", fontSize: 13 }}>
                  No accounts yet. Create your first pilot →
                </div>
              )}
            </div>
          </div>

          {/* ── New Pilot form ───────────────────────────────────────────── */}
          <div style={{ position: "sticky", top: 24 }}>
            <h2 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 600, color: "#CBD5E1" }}>New Pilot</h2>
            <NewPilotForm />
          </div>

        </div>
      </div>
    </div>
  );
}
