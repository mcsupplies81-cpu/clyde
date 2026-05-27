/**
 * Risk Engine — evaluates tenant risk rules against a load and returns the
 * computed risk level.  Rules are evaluated in priority order (lower number =
 * higher priority); first match wins.
 *
 * If no rules match, we fall back to a default heuristic:
 *   - rate >= $3000  → high
 *   - rate >= $2000  → medium
 *   - else           → low
 */

import { db } from "@/db";
import { riskRules, loads } from "@/db/schema";
import { and, eq, asc } from "drizzle-orm";

export type RiskLevel = "low" | "medium" | "high" | "critical";

type LoadForRisk = {
  customerName: string | null;
  carrierName:  string | null;
  equipmentType: string | null;
  originState:  string | null;
  destinationState: string | null;
  rate: string | null;
};

function matchesRule(
  rule: { ruleType: string; matchValue: string; operator: string | null },
  load: LoadForRisk,
): boolean {
  const op = rule.operator ?? "contains";

  switch (rule.ruleType) {
    case "customer": {
      const name = load.customerName?.toLowerCase() ?? "";
      return op === "contains"
        ? name.includes(rule.matchValue.toLowerCase())
        : name === rule.matchValue.toLowerCase();
    }
    case "equipment": {
      const eq_ = load.equipmentType?.toLowerCase() ?? "";
      return eq_.includes(rule.matchValue.toLowerCase());
    }
    case "lane": {
      const val = rule.matchValue.toUpperCase();
      return load.originState?.toUpperCase() === val || load.destinationState?.toUpperCase() === val;
    }
    case "rate_threshold": {
      const rate = parseFloat(load.rate ?? "0");
      const threshold = parseFloat(rule.matchValue);
      if (op === "gte") return rate >= threshold;
      if (op === "lte") return rate <= threshold;
      return rate === threshold;
    }
    default:
      return false;
  }
}

export async function computeRiskLevel(tenantId: string, load: LoadForRisk): Promise<RiskLevel> {
  const rules = await db
    .select()
    .from(riskRules)
    .where(and(eq(riskRules.tenantId, tenantId), eq(riskRules.isActive, true)))
    .orderBy(asc(riskRules.priority));

  for (const rule of rules) {
    if (matchesRule(rule, load)) {
      return (rule.riskLevel as RiskLevel) ?? "medium";
    }
  }

  // Default heuristic when no rules defined
  const rate = parseFloat(load.rate ?? "0");
  if (rate >= 3000) return "high";
  if (rate >= 2000) return "medium";
  return "low";
}

/** Recompute and persist risk level for a single load. */
export async function refreshLoadRisk(tenantId: string, loadId: string): Promise<RiskLevel> {
  const load_ = await db.query.loads.findFirst({
    where: and(eq(loads.id, loadId), eq(loads.tenantId, tenantId)),
    columns: { customerName: true, carrierName: true, equipmentType: true, originState: true, destinationState: true, rate: true },
  });
  if (!load_) return "low";

  const risk = await computeRiskLevel(tenantId, load_);
  await db.update(loads).set({ riskLevel: risk }).where(and(eq(loads.id, loadId), eq(loads.tenantId, tenantId)));
  return risk;
}
