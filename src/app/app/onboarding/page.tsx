import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { tenants, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

export default async function OnboardingPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const existing = await db.query.users.findFirst({ where: eq(users.clerkUserId, userId) });
  if (existing?.tenantId) redirect("/app/inbox");

  async function createCompany(formData: FormData) {
    "use server";
    const { userId: uid } = await auth();
    if (!uid) redirect("/sign-in");
    const name = String(formData.get("companyName") ?? "").trim();
    if (!name) return;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || `tenant-${Date.now()}`;
    const [tenant] = await db.insert(tenants).values({ name, slug }).returning();
    await db.insert(users).values({
      tenantId: tenant.id,
      name: "Admin",
      email: `${uid}@clerk.local`,
      clerkUserId: uid,
      role: "admin",
    });
    redirect("/app/inbox");
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FAFAF8" }}>
      <div style={{ background: "#FFFFFF", border: "1px solid #E8E8E8", borderRadius: 12, padding: 40, maxWidth: 440, width: "100%" }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: "#292929" }}>Create your company</h1>
        <p style={{ margin: "0 0 24px", fontSize: 13, color: "#7F7F7F" }}>Set up your freight brokerage workspace.</p>
        <form action={createCompany} style={{ display: "grid", gap: 12 }}>
          <input
            name="companyName"
            placeholder="Company name"
            required
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #E8E8E8",
              background: "#FAFAF8",
              color: "#292929",
              fontSize: 13,
              outline: "none",
            }}
          />
          <button
            type="submit"
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              border: "none",
              background: "#2563EB",
              color: "#FFFFFF",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Continue →
          </button>
        </form>
      </div>
    </div>
  );
}
