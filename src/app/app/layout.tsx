import { SidebarNav } from "@/components/SidebarNav";
import { TopBar } from "@/components/TopBar";
import { db } from "@/db";
import { emailThreads } from "@/db/schema";
import { and, eq, notInArray } from "drizzle-orm";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const tenantId = process.env.DEMO_TENANT_ID ?? "";

  let openCount = 0;
  if (tenantId) {
    openCount = await db.$count(
      emailThreads,
      and(
        eq(emailThreads.tenantId, tenantId),
        notInArray(emailThreads.status, ["resolved", "sent", "escalated"]),
      ),
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "#FAFAF8" }}>
      <SidebarNav inboxCount={openCount} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <TopBar />
        <main style={{ flex: 1, overflow: "auto" }}>{children}</main>
      </div>
    </div>
  );
}
