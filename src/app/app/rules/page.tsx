import { revalidatePath } from "next/cache";
import { and, asc, eq } from "drizzle-orm";

import { CategoryBadge } from "@/components/CategoryBadge";
import { db } from "@/db";
import { sopRules } from "@/db/schema";
import { CATEGORIES } from "@/lib/ai-classifier";

function getTenantId() {
  return process.env.DEMO_TENANT_ID ?? "";
}

async function createRule(formData: FormData) {
  "use server";
  const tenantId = getTenantId();
  if (!tenantId) throw new Error("DEMO_TENANT_ID not set");

  const name     = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "unknown").trim();
  const ruleText = String(formData.get("ruleText") ?? "").trim();
  const requireApproval = formData.get("requireApproval") === "on";

  if (!name || !ruleText || !CATEGORIES.includes(category as (typeof CATEGORIES)[number])) {
    throw new Error("Invalid rule data");
  }

  await db.insert(sopRules).values({ tenantId, name, category, ruleText, requireApproval, isActive: true });
  revalidatePath("/app/rules");
}

async function updateRule(formData: FormData) {
  "use server";
  const tenantId = getTenantId();
  if (!tenantId) throw new Error("DEMO_TENANT_ID not set");

  const id       = String(formData.get("id") ?? "");
  const name     = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "unknown").trim();
  const ruleText = String(formData.get("ruleText") ?? "").trim();
  const requireApproval = formData.get("requireApproval") === "on";

  if (!id || !name || !ruleText || !CATEGORIES.includes(category as (typeof CATEGORIES)[number])) {
    throw new Error("Invalid rule data");
  }

  await db.update(sopRules).set({ name, category, ruleText, requireApproval }).where(and(eq(sopRules.id, id), eq(sopRules.tenantId, tenantId)));
  revalidatePath("/app/rules");
}

async function toggleRuleActive(formData: FormData) {
  "use server";
  const tenantId = getTenantId();
  if (!tenantId) throw new Error("DEMO_TENANT_ID not set");

  const id       = String(formData.get("id") ?? "");
  const isActive = formData.get("isActive") === "true";
  if (!id) throw new Error("Missing rule id");

  await db.update(sopRules).set({ isActive: !isActive }).where(and(eq(sopRules.id, id), eq(sopRules.tenantId, tenantId)));
  revalidatePath("/app/rules");
}

async function deleteRule(formData: FormData) {
  "use server";
  const tenantId = getTenantId();
  if (!tenantId) throw new Error("DEMO_TENANT_ID not set");

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing rule id");

  await db.delete(sopRules).where(and(eq(sopRules.id, id), eq(sopRules.tenantId, tenantId)));
  revalidatePath("/app/rules");
}

const INPUT_STYLE = {
  background: "#FFFFFF", border: "1px solid #E8E8E8", color: "#292929",
  borderRadius: 6, padding: "8px 10px", fontSize: 12, outline: "none",
} as const;

function RuleCard({ rule }: { rule: typeof sopRules.$inferSelect }) {
  return (
    <div style={{ background: "#FFFFFF", border: "1px solid #E8E8E8", borderRadius: 8, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
            <strong style={{ color: "#292929", fontSize: 14 }}>{rule.name}</strong>
            <CategoryBadge category={rule.category} />
            {rule.requireApproval && (
              <span style={{ fontSize: 11, color: "#D97706", background: "#FFFBEB", border: "1px solid #FDE68A", padding: "2px 7px", borderRadius: 4 }}>
                Requires approval
              </span>
            )}
            {!rule.isActive && (
              <span style={{ fontSize: 11, color: "#9CA3AF", background: "#F9FAFB", border: "1px solid #E8E8E8", padding: "2px 7px", borderRadius: 4 }}>
                Inactive
              </span>
            )}
          </div>
          <p style={{ margin: 0, color: "#5D5D5D", fontSize: 13, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{rule.ruleText}</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <form action={toggleRuleActive}>
            <input type="hidden" name="id"       value={rule.id} />
            <input type="hidden" name="isActive" value={String(rule.isActive)} />
            <button type="submit" style={{ padding: "6px 10px", fontSize: 12, background: "#F9FAFB", color: "#5D5D5D", border: "1px solid #E8E8E8", borderRadius: 5, cursor: "pointer" }}>
              {rule.isActive ? "Set inactive" : "Set active"}
            </button>
          </form>
          <details>
            <summary style={{ listStyle: "none", cursor: "pointer", padding: "6px 10px", fontSize: 12, background: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE", borderRadius: 5, fontWeight: 600 }}>
              Edit
            </summary>
            <form action={updateRule} style={{ marginTop: 10, background: "#FFFFFF", border: "1px solid #E8E8E8", borderRadius: 6, padding: 12, minWidth: 320 }}>
              <input type="hidden" name="id" value={rule.id} />
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <input name="name" defaultValue={rule.name} required style={INPUT_STYLE} />
                <select name="category" defaultValue={rule.category} style={INPUT_STYLE}>
                  {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
                <textarea name="ruleText" defaultValue={rule.ruleText} required rows={3} style={{ ...INPUT_STYLE, resize: "vertical" }} />
                <label style={{ fontSize: 12, color: "#5D5D5D", display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="checkbox" name="requireApproval" defaultChecked={rule.requireApproval} /> Require approval
                </label>
                <button type="submit" style={{ padding: "8px 12px", fontSize: 12, background: "#2563EB", color: "#FFFFFF", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
                  Save
                </button>
              </div>
            </form>
          </details>
          <form action={deleteRule}>
            <input type="hidden" name="id" value={rule.id} />
            <button type="submit" style={{ padding: "6px 10px", fontSize: 12, background: "transparent", color: "#DC2626", border: "1px solid #FECACA", borderRadius: 5, cursor: "pointer" }}>
              Delete
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default async function RulesPage() {
  const tenantId = getTenantId();

  if (!tenantId) {
    return <div style={{ padding: 32, color: "#DC2626" }}>DEMO_TENANT_ID not set. Run <code>npm run db:seed</code>.</div>;
  }

  const rules = await db.query.sopRules.findMany({
    where: eq(sopRules.tenantId, tenantId),
    orderBy: [asc(sopRules.name)],
  });

  const activeRules   = rules.filter((r) => r.isActive);
  const inactiveRules = rules.filter((r) => !r.isActive);

  return (
    <div style={{ padding: 24, background: "#FAFAF8", minHeight: "100%", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#292929", letterSpacing: "-0.5px" }}>SOP Rules</h1>
          <div style={{ color: "#9CA3AF", fontSize: 12, marginTop: 4 }}>Standard operating procedures used to guide AI draft generation</div>
        </div>
        <details>
          <summary style={{ listStyle: "none", cursor: "pointer", padding: "7px 14px", fontSize: 12, background: "#2563EB", color: "#FFFFFF", border: "none", borderRadius: 6, fontWeight: 600 }}>
            + Add Rule
          </summary>
          <form action={createRule} style={{ marginTop: 10, background: "#FFFFFF", border: "1px solid #E8E8E8", borderRadius: 8, padding: 14, width: 420, maxWidth: "calc(100vw - 80px)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input name="name" placeholder="Rule name" required style={INPUT_STYLE} />
              <select name="category" defaultValue={CATEGORIES[0]} style={INPUT_STYLE}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <textarea name="ruleText" placeholder="Rule description — e.g. 'Always include load number in reply'" required rows={4} style={{ ...INPUT_STYLE, resize: "vertical" }} />
              <label style={{ fontSize: 12, color: "#5D5D5D", display: "flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" name="requireApproval" /> Require approval before sending
              </label>
              <button type="submit" style={{ padding: "8px 12px", fontSize: 12, background: "#2563EB", color: "#FFFFFF", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
                Save Rule
              </button>
            </div>
          </form>
        </details>
      </div>

      <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.6px" }}>
          Active Rules ({activeRules.length})
        </div>
        {activeRules.length > 0
          ? activeRules.map((rule) => <RuleCard key={rule.id} rule={rule} />)
          : <div style={{ color: "#9CA3AF", fontSize: 13, padding: "16px 0" }}>No active rules. Add one above.</div>
        }
      </section>

      {inactiveRules.length > 0 && (
        <details>
          <summary style={{ cursor: "pointer", color: "#7F7F7F", fontSize: 12, fontWeight: 600 }}>
            Inactive Rules ({inactiveRules.length})
          </summary>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
            {inactiveRules.map((rule) => <RuleCard key={rule.id} rule={rule} />)}
          </div>
        </details>
      )}
    </div>
  );
}
