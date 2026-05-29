"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { db } from "@/db";
import { tenants, inboxes, inviteTokens, users } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { isAdmin } from "@/lib/auth";

function guard() { return isAdmin(); }

export async function createPilotAction(formData: FormData): Promise<{ error?: string; inviteUrl?: string; tenantId?: string }> {
  if (!await guard()) return { error: "Unauthorized" };

  const companyName  = String(formData.get("companyName") ?? "").trim();
  const contactEmail = String(formData.get("contactEmail") ?? "").trim().toLowerCase();
  const seatLimit    = Math.max(1, parseInt(String(formData.get("seatLimit") ?? "5"), 10) || 5);
  const trialDays    = Math.max(1, parseInt(String(formData.get("trialDays") ?? "30"), 10) || 30);
  const plan         = (String(formData.get("plan") ?? "pilot")) as "pilot" | "paid";
  const notes        = String(formData.get("notes") ?? "").trim() || null;

  if (!companyName) return { error: "Company name is required" };

  const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) + `-${Date.now()}`;

  const [tenant] = await db.insert(tenants).values({
    name: companyName,
    slug,
    plan,
    status: "trial",
    seatLimit,
    trialEndsAt: new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000),
    contactEmail: contactEmail || null,
    notes,
  }).returning();

  // Create their default inbox
  await db.insert(inboxes).values({
    tenantId: tenant.id,
    name: "Main Inbox",
    emailAddress: `${slug}@inbox.clydefreight.com`,
    provider: "other",
  });

  // Generate invite token
  const token = randomBytes(24).toString("hex");
  await db.insert(inviteTokens).values({
    tenantId: tenant.id,
    token,
    email: contactEmail || null,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // invite valid 30 days
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
  const inviteUrl = `${baseUrl}/invite/${token}`;

  revalidatePath("/admin");
  return { inviteUrl, tenantId: tenant.id };
}

export async function updateTenantAdminAction(formData: FormData): Promise<{ error?: string }> {
  if (!await guard()) return { error: "Unauthorized" };

  const tenantId  = String(formData.get("tenantId") ?? "").trim();
  const notes     = String(formData.get("notes") ?? "").trim() || null;
  const seatLimit = parseInt(String(formData.get("seatLimit") ?? "5"), 10) || 5;
  const status    = String(formData.get("status") ?? "active") as "active" | "inactive" | "trial" | "churned";
  const plan      = String(formData.get("plan") ?? "pilot") as "demo" | "pilot" | "paid" | "churned";

  if (!tenantId) return { error: "Missing tenantId" };

  await db.update(tenants).set({ notes, seatLimit, status, plan }).where(eq(tenants.id, tenantId));
  revalidatePath("/admin");
  return {};
}

export async function generateNewInviteAction(tenantId: string): Promise<{ inviteUrl?: string; error?: string }> {
  if (!await guard()) return { error: "Unauthorized" };

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
    columns: { contactEmail: true },
  });
  if (!tenant) return { error: "Tenant not found" };

  const token = randomBytes(24).toString("hex");
  await db.insert(inviteTokens).values({
    tenantId,
    token,
    email: tenant.contactEmail ?? null,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
  revalidatePath("/admin");
  return { inviteUrl: `${baseUrl}/invite/${token}` };
}
