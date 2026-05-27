import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { tenants, users, inboxes } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Returns the tenant ID for the currently authenticated Clerk user.
 * On first sign-in, automatically provisions a tenant + inbox + user row.
 * Falls back to DEMO_TENANT_ID in dev when Clerk is not configured.
 */
export async function getTenantIdForUser(): Promise<string | null> {
  const { userId } = await auth();

  // No Clerk session — dev fallback
  if (!userId) {
    return process.env.DEMO_TENANT_ID ?? null;
  }

  // Happy path: user already has a tenant
  const existing = await db.query.users.findFirst({
    where: eq(users.clerkUserId, userId),
    columns: { tenantId: true },
  });
  if (existing?.tenantId) return existing.tenantId;

  // First sign-in: provision tenant + inbox + user
  return provisionTenant(userId);
}

async function provisionTenant(clerkUserId: string): Promise<string> {
  const profile = await currentUser();
  const email = profile?.emailAddresses[0]?.emailAddress ?? "";
  const name =
    profile?.fullName ??
    profile?.firstName ??
    email.split("@")[0] ??
    "New User";

  const tenantName = `${name}'s Brokerage`;
  const slugBase = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "-");
  const slug = `${slugBase}-${Date.now()}`;

  // 1. Create tenant
  const [tenant] = await db.insert(tenants).values({ name: tenantName, slug }).returning();

  // 2. Create inbox (email address is a placeholder — user updates in Settings)
  const inboxEmail = `${slug}@inbox.clydefreight.com`;
  await db.insert(inboxes).values({
    tenantId: tenant.id,
    name: "Main Inbox",
    emailAddress: inboxEmail,
    provider: "other",
  });

  // 3. Create user row
  await db.insert(users).values({
    tenantId: tenant.id,
    clerkUserId,
    name,
    email,
    role: "admin",
  });

  console.log(`[auth] Provisioned tenant ${tenant.id} for ${email}`);
  return tenant.id;
}
