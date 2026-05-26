import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { sopRules } from "@/db/schema";
import { CATEGORIES } from "@/lib/ai-classifier";
import { RulesClient } from "./RulesClient";
import { createRuleAction, updateRuleAction, toggleRuleAction, deleteRuleAction } from "./actions";

export default async function RulesPage() {
  const tenantId = process.env.DEMO_TENANT_ID ?? "";
  if (!tenantId) {
    return <div style={{ padding: 32, color: "#DC2626" }}>DEMO_TENANT_ID not set. Run <code>npm run db:seed</code>.</div>;
  }
  const rules = await db.query.sopRules.findMany({
    where: eq(sopRules.tenantId, tenantId),
    orderBy: [asc(sopRules.category), asc(sopRules.name)],
  });
  return (
    <RulesClient
      rules={rules}
      categories={CATEGORIES as unknown as string[]}
      createAction={createRuleAction}
      updateAction={updateRuleAction}
      toggleAction={toggleRuleAction}
      deleteAction={deleteRuleAction}
    />
  );
}
