"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { riskRules } from "@/db/schema";
import { getTenantIdForUser } from "@/lib/auth";

type Result = { ok?: boolean; error?: string };

export async function createRiskRuleAction(_prev: Result | undefined, formData: FormData): Promise<Result> {
  const tenantId = (await getTenantIdForUser()) ?? "";
  if (!tenantId) return { error: "Not authenticated" };

  const label      = String(formData.get("label") ?? "").trim();
  const ruleType   = String(formData.get("ruleType") ?? "") as "customer" | "rate_threshold" | "equipment" | "lane";
  const matchValue = String(formData.get("matchValue") ?? "").trim();
  const operator   = String(formData.get("operator") ?? "contains").trim() || "contains";
  const riskLevel  = String(formData.get("riskLevel") ?? "high").trim();
  const priority   = parseInt(String(formData.get("priority") ?? "0"), 10);

  if (!label || !ruleType || !matchValue) return { error: "Label, type, and match value are required" };

  const validTypes = ["customer", "rate_threshold", "equipment", "lane"];
  if (!validTypes.includes(ruleType)) return { error: "Invalid rule type" };

  const validLevels = ["low", "medium", "high", "critical"];
  if (!validLevels.includes(riskLevel)) return { error: "Invalid risk level" };

  await db.insert(riskRules).values({
    tenantId,
    label,
    ruleType,
    matchValue,
    operator,
    riskLevel,
    priority: isNaN(priority) ? 0 : priority,
    isActive: true,
  });

  revalidatePath("/app/rules");
  return { ok: true };
}

export async function toggleRiskRuleAction(_prev: Result | undefined, formData: FormData): Promise<Result> {
  const tenantId = (await getTenantIdForUser()) ?? "";
  const id       = String(formData.get("id") ?? "");
  const isActive = formData.get("isActive") === "true";
  if (!tenantId || !id) return { error: "Missing params" };

  await db.update(riskRules).set({ isActive: !isActive }).where(and(eq(riskRules.id, id), eq(riskRules.tenantId, tenantId)));
  revalidatePath("/app/rules");
  return { ok: true };
}

export async function deleteRiskRuleAction(_prev: Result | undefined, formData: FormData): Promise<Result> {
  const tenantId = (await getTenantIdForUser()) ?? "";
  const id       = String(formData.get("id") ?? "");
  if (!tenantId || !id) return { error: "Missing params" };

  await db.delete(riskRules).where(and(eq(riskRules.id, id), eq(riskRules.tenantId, tenantId)));
  revalidatePath("/app/rules");
  return { ok: true };
}
