import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { tenants, users, inboxes, inviteTokens } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";

/**
 * Returns the tenant ID for the currently authenticated Clerk user.
 *
 * Priority order:
 *  1. Authenticated Clerk user → their real tenant (created on first sign-in)
 *  2. No Clerk session + DEMO_TENANT_ID set → demo tenant (for unauthenticated demos)
 *
 * This means pilots/customers always get their own isolated workspace,
 * while unauthenticated visitors to the demo URL see the seed data.
 */
export async function getTenantIdForUser(): Promise<string | null> {
  const { userId } = await auth();

  // Authenticated user — always resolve to their real tenant
  if (userId) {
    const existing = await db.query.users.findFirst({
      where: eq(users.clerkUserId, userId),
      columns: { tenantId: true },
    });
    if (existing?.tenantId) return existing.tenantId;

    // First sign-in: check for a pending invite token first
    return provisionTenant(userId);
  }

  // No Clerk session — fall back to demo tenant if configured
  // (used for unauthenticated sales demos)
  if (process.env.DEMO_TENANT_ID) {
    return process.env.DEMO_TENANT_ID;
  }

  return null;
}

/**
 * Check if the current user is the Clyde super-admin.
 * Protected by ADMIN_EMAIL env var (set to cam@usexiq.com in Vercel).
 */
export async function isAdmin(): Promise<boolean> {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return false;
  const profile = await currentUser();
  return profile?.emailAddresses.some((e) => e.emailAddress === adminEmail) ?? false;
}

async function provisionTenant(clerkUserId: string): Promise<string> {
  const profile = await currentUser();
  const email = profile?.emailAddresses[0]?.emailAddress ?? "";
  const name =
    profile?.fullName ??
    profile?.firstName ??
    email.split("@")[0] ??
    "New User";

  // Check if this user was invited to a pre-created tenant
  // Invite tokens are stored in a cookie set by /invite/[token] before sign-up
  // We match on email since Clerk user exists now
  if (email) {
    const invite = await db.query.inviteTokens.findFirst({
      where: and(
        eq(inviteTokens.email, email),
        gt(inviteTokens.expiresAt, new Date()),
      ),
      columns: { id: true, tenantId: true },
    });

    if (invite) {
      // Assign user to the pre-created tenant
      const [inserted] = await db
        .insert(users)
        .values({ tenantId: invite.tenantId, clerkUserId, name, email, role: "admin" })
        .onConflictDoNothing()
        .returning();

      // Mark invite as used
      await db.update(inviteTokens)
        .set({ usedAt: new Date(), usedByClerkId: clerkUserId })
        .where(eq(inviteTokens.id, invite.id));

      console.log(`[auth] Assigned invited user ${email} to tenant ${invite.tenantId}`);
      return inserted?.tenantId ?? invite.tenantId;
    }
  }

  // No invite — self-serve: create a new tenant for this user
  const tenantName = name.includes("Brokerage") ? name : `${name}'s Brokerage`;
  const slugBase = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "-");
  const slug = `${slugBase}-${Date.now()}`;

  const [tenant] = await db.insert(tenants).values({
    name: tenantName,
    slug,
    plan: "pilot",
    status: "trial",
    seatLimit: 5,
    trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30-day trial
    contactEmail: email,
  }).returning();

  await db.insert(inboxes).values({
    tenantId: tenant.id,
    name: "Main Inbox",
    emailAddress: `${slug}@inbox.clydefreight.com`,
    provider: "other",
  });

  const [inserted] = await db
    .insert(users)
    .values({ tenantId: tenant.id, clerkUserId, name, email, role: "admin" })
    .onConflictDoNothing()
    .returning();

  if (inserted) {
    console.log(`[auth] Provisioned tenant ${tenant.id} for ${email}`);
    return inserted.tenantId;
  }

  const raceWinner = await db.query.users.findFirst({
    where: eq(users.clerkUserId, clerkUserId),
    columns: { tenantId: true },
  });
  return raceWinner!.tenantId;
}
