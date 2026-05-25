import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

let warnedDemoFallback = false;

export async function getTenantIdForUser(): Promise<string | null> {
  const { userId } = await auth();

  if (!userId) {
    if (process.env.DEMO_TENANT_ID) {
      if (!warnedDemoFallback) {
        console.warn("Using DEMO_TENANT_ID — not for production");
        warnedDemoFallback = true;
      }
      return process.env.DEMO_TENANT_ID;
    }
    return null;
  }

  const appUser = await db.query.users.findFirst({
    where: eq(users.clerkUserId, userId),
  });

  if (appUser?.tenantId) return appUser.tenantId;
  return process.env.DEMO_TENANT_ID ?? null;
}

export async function getCurrentClerkProfile() {
  const user = await currentUser();
  return user;
}
