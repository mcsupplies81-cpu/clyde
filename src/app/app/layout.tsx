import { SidebarNav } from "@/components/SidebarNav";
import { TopBar } from "@/components/TopBar";
import { db } from "@/db";
import { emailThreads, inboxes, tenants } from "@/db/schema";
import { and, asc, eq, notInArray } from "drizzle-orm";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const tenantId = process.env.DEMO_TENANT_ID ?? "";

  const [openCount, inbox, tenant] = await Promise.all([
    tenantId
      ? db.$count(emailThreads, and(eq(emailThreads.tenantId, tenantId), notInArray(emailThreads.status, ["resolved", "sent", "escalated"])))
      : Promise.resolve(0),
    tenantId
      ? db.query.inboxes.findFirst({ where: eq(inboxes.tenantId, tenantId), orderBy: [asc(inboxes.createdAt)] })
      : Promise.resolve(null),
    tenantId
      ? db.query.tenants.findFirst({ where: eq(tenants.id, tenantId) })
      : Promise.resolve(null),
  ]);

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "#F8F8F7" }}>
      <SidebarNav
        inboxCount={openCount}
        inboxEmail={inbox?.emailAddress ?? null}
        companyName={tenant?.name ?? null}
      />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <TopBar companyName={tenant?.name ?? null} />
        <main style={{ flex: 1, overflow: "auto" }}>{children}</main>
      </div>
    </div>
  );
}
