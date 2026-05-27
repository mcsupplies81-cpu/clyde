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

  // 3. Upsert user row — race-safe: concurrent cold-start renders may both attempt this
  //    If clerk_user_id already exists (race), ignore the conflict and re-query.
  const [inserted] = await db
    .insert(users)
    .values({ tenantId: tenant.id, clerkUserId, name, email, role: "admin" })
    .onConflictDoNothing()
    .returning();

  if (inserted) {
    console.log(`[auth] Provisioned tenant ${tenant.id} for ${email}`);
    return inserted.tenantId;
  }

  // Race: another parallel render won — fetch the existing user's tenant
  const raceWinner = await db.query.users.findFirst({
    where: eq(users.clerkUserId, clerkUserId),
    columns: { tenantId: true },
  });
  // Note: the tenant/inbox we just created is orphaned — acceptable for now (rare race)
  console.log(`[auth] Race resolved for ${email}, using tenant ${raceWinner?.tenantId}`);
  return raceWinner!.tenantId;
}
