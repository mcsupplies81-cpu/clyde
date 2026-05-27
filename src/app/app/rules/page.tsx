import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { sopRules, riskRules } from "@/db/schema";
import { CATEGORIES } from "@/lib/ai-classifier";
import { getTenantIdForUser } from "@/lib/auth";
import { RulesClient } from "./RulesClient";
import { RiskRulesSection } from "./RiskRulesSection";
import { createRuleAction, updateRuleAction, toggleRuleAction, deleteRuleAction } from "./actions";
import { createRiskRuleAction, toggleRiskRuleAction, deleteRiskRuleAction } from "./risk-actions";

export default async function RulesPage() {
  const tenantId = (await getTenantIdForUser()) ?? "";
  if (!tenantId) {
    return <div style={{ padding: 32, color: "#DC2626" }}>Not authenticated.</div>;
  }

  const [sopRuleList, riskRuleList] = await Promise.all([
    db.query.sopRules.findMany({
      where: eq(sopRules.tenantId, tenantId),
      orderBy: [asc(sopRules.category), asc(sopRules.name)],
    }),
    db.query.riskRules.findMany({
      where: eq(riskRules.tenantId, tenantId),
      orderBy: [asc(riskRules.priority)],
    }),
  ]);

  return (
    <div style={{ background: "#FAFAF8", minHeight: "100%", display: "flex", flexDirection: "column" }}>
      {/* Risk Rules section */}
      <div style={{ padding: "24px 24px 0" }}>
        <RiskRulesSection
          rules={riskRuleList as Parameters<typeof RiskRulesSection>[0]["rules"]}
          createAction={createRiskRuleAction}
          toggleAction={toggleRiskRuleAction}
          deleteAction={deleteRiskRuleAction}
        />
      </div>

      {/* Divider */}
      <div style={{ margin: "24px 24px 0", borderTop: "2px solid #F0F0F0", paddingTop: 24 }} />

      {/* SOP Rules section */}
      <RulesClient
        rules={sopRuleList}
        categories={CATEGORIES as unknown as string[]}
        createAction={createRuleAction}
        updateAction={updateRuleAction}
        toggleAction={toggleRuleAction}
        deleteAction={deleteRuleAction}
      />
    </div>
  );
}
