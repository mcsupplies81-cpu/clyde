"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { sopRules } from "@/db/schema";
import { CATEGORIES } from "@/lib/ai-classifier";
import { getTenantIdForUser } from "@/lib/auth";

type Result = { ok?: boolean; error?: string };

export async function createRuleAction(_prev: Result | undefined, formData: FormData): Promise<Result> {
  const tenantId = (await getTenantIdForUser()) ?? "";
  if (!tenantId) return { error: "Not authenticated" };
  const name            = String(formData.get("name") ?? "").trim();
  const category        = String(formData.get("category") ?? "unknown").trim();
  const ruleText        = String(formData.get("ruleText") ?? "").trim();
  const requireApproval = formData.get("requireApproval") === "on";
  if (!name || !ruleText) return { error: "Name and rule text are required" };
  await db.insert(sopRules).values({ tenantId, name, category, ruleText, requireApproval, isActive: true });
  revalidatePath("/app/rules");
  return { ok: true };
}

export async function updateRuleAction(_prev: Result | undefined, formData: FormData): Promise<Result> {
  const tenantId = (await getTenantIdForUser()) ?? "";
  if (!tenantId) return { error: "Not authenticated" };
  const id              = String(formData.get("id") ?? "");
  const name            = String(formData.get("name") ?? "").trim();
  const category        = String(formData.get("category") ?? "unknown").trim();
  const ruleText        = String(formData.get("ruleText") ?? "").trim();
  const requireApproval = formData.get("requireApproval") === "on";
  if (!id || !name || !ruleText) return { error: "Missing fields" };
  await db.update(sopRules).set({ name, category, ruleText, requireApproval }).where(and(eq(sopRules.id, id), eq(sopRules.tenantId, tenantId)));
  revalidatePath("/app/rules");
  return { ok: true };
}

export async function toggleRuleAction(_prev: Result | undefined, formData: FormData): Promise<Result> {
  const tenantId = (await getTenantIdForUser()) ?? "";
  const id       = String(formData.get("id") ?? "");
  const isActive = formData.get("isActive") === "true";
  if (!tenantId || !id) return { error: "Missing params" };
  await db.update(sopRules).set({ isActive: !isActive }).where(and(eq(sopRules.id, id), eq(sopRules.tenantId, tenantId)));
  revalidatePath("/app/rules");
  return { ok: true };
}

export async function deleteRuleAction(_prev: Result | undefined, formData: FormData): Promise<Result> {
  const tenantId = (await getTenantIdForUser()) ?? "";
  const id       = String(formData.get("id") ?? "");
  if (!tenantId || !id) return { error: "Missing params" };
  await db.delete(sopRules).where(and(eq(sopRules.id, id), eq(sopRules.tenantId, tenantId)));
  revalidatePath("/app/rules");
  return { ok: true };
}
