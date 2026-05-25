import { revalidatePath } from "next/cache";
import { and, asc, eq } from "drizzle-orm";

import { CategoryBadge } from "@/components/CategoryBadge";
import { db } from "@/db";
import { sopRules } from "@/db/schema";
import { CATEGORIES } from "@/lib/ai-classifier";

const tenantId = process.env.DEMO_TENANT_ID ?? "";

async function createRule(formData: FormData) {
  "use server";

  if (!tenantId) throw new Error("DEMO_TENANT_ID not set");

  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "unknown").trim();
  const ruleText = String(formData.get("ruleText") ?? "").trim();
  const requireApproval = formData.get("requireApproval") === "on";

  if (!name || !ruleText || !CATEGORIES.includes(category as (typeof CATEGORIES)[number])) {
    throw new Error("Invalid rule data");
  }

  await db.insert(sopRules).values({
    tenantId,
    name,
    category,
    ruleText,
    requireApproval,
    isActive: true,
  });

  revalidatePath("/app/rules");
}

async function updateRule(formData: FormData) {
  "use server";

  if (!tenantId) throw new Error("DEMO_TENANT_ID not set");

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "unknown").trim();
  const ruleText = String(formData.get("ruleText") ?? "").trim();
  const requireApproval = formData.get("requireApproval") === "on";

  if (!id || !name || !ruleText || !CATEGORIES.includes(category as (typeof CATEGORIES)[number])) {
    throw new Error("Invalid rule data");
  }

  await db
    .update(sopRules)
    .set({ name, category, ruleText, requireApproval })
    .where(and(eq(sopRules.id, id), eq(sopRules.tenantId, tenantId)));

  revalidatePath("/app/rules");
}

async function toggleRuleActive(formData: FormData) {
  "use server";

  if (!tenantId) throw new Error("DEMO_TENANT_ID not set");

  const id = String(formData.get("id") ?? "");
  const isActive = formData.get("isActive") === "true";

  if (!id) throw new Error("Missing rule id");

  await db
    .update(sopRules)
    .set({ isActive: !isActive })
    .where(and(eq(sopRules.id, id), eq(sopRules.tenantId, tenantId)));

  revalidatePath("/app/rules");
}

async function deleteRule(formData: FormData) {
  "use server";

  if (!tenantId) throw new Error("DEMO_TENANT_ID not set");

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing rule id");

  await db.delete(sopRules).where(and(eq(sopRules.id, id), eq(sopRules.tenantId, tenantId)));

  revalidatePath("/app/rules");
}

function RuleCard({ rule }: { rule: typeof sopRules.$inferSelect }) {
  return (
    <div style={{ background: "#141c24", border: "1px solid #1e2d3d", borderRadius: 8, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
            <strong style={{ color: "#d6e0eb", fontSize: 14 }}>{rule.name}</strong>
            <CategoryBadge category={rule.category} />
            {rule.requireApproval && (
              <span style={{ fontSize: 11, color: "#fbbf24", background: "#fbbf241a", border: "1px solid #3f2d08", padding: "2px 7px", borderRadius: 4 }}>
                Requires approval
              </span>
            )}
          </div>
          <p style={{ margin: 0, color: "#a8bdd4", fontSize: 13, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{rule.ruleText}</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <form action={toggleRuleActive}>
            <input type="hidden" name="id" value={rule.id} />
            <input type="hidden" name="isActive" value={String(rule.isActive)} />
            <button type="submit" style={{ padding: "6px 10px", fontSize: 12, background: "#1a2535", color: "#d6e0eb", border: "1px solid #253347", borderRadius: 5, cursor: "pointer" }}>
              {rule.isActive ? "Set inactive" : "Set active"}
            </button>
          </form>
          <details>
            <summary style={{ listStyle: "none", cursor: "pointer", padding: "6px 10px", fontSize: 12, background: "#1a2535", color: "#60a5fa", border: "1px solid #253347", borderRadius: 5 }}>
              Edit
            </summary>
            <form action={updateRule} style={{ marginTop: 10, background: "#0f1721", border: "1px solid #1e2d3d", borderRadius: 6, padding: 12, minWidth: 320 }}>
              <input type="hidden" name="id" value={rule.id} />
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <input name="name" defaultValue={rule.name} required style={{ background: "#0b1118", border: "1px solid #253347", color: "#d6e0eb", borderRadius: 6, padding: "8px 10px", fontSize: 12 }} />
                <select name="category" defaultValue={rule.category} style={{ background: "#0b1118", border: "1px solid #253347", color: "#d6e0eb", borderRadius: 6, padding: "8px 10px", fontSize: 12 }}>
                  {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
                <textarea name="ruleText" defaultValue={rule.ruleText} required rows={3} style={{ background: "#0b1118", border: "1px solid #253347", color: "#d6e0eb", borderRadius: 6, padding: "8px 10px", fontSize: 12, resize: "vertical" }} />
                <label style={{ fontSize: 12, color: "#a8bdd4", display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="checkbox" name="requireApproval" defaultChecked={rule.requireApproval} /> Require approval
                </label>
                <button type="submit" style={{ padding: "8px 12px", fontSize: 12, background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>Save</button>
              </div>
            </form>
          </details>
          <form action={deleteRule}>
            <input type="hidden" name="id" value={rule.id} />
            <button type="submit" style={{ padding: "6px 10px", fontSize: 12, background: "transparent", color: "#f87171", border: "1px solid #450a0a", borderRadius: 5, cursor: "pointer" }}>
              Delete
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default async function RulesPage() {
  if (!tenantId) {
    return <div style={{ padding: 32, color: "#f87171" }}>DEMO_TENANT_ID not set.</div>;
  }

  const rules = await db.query.sopRules.findMany({
    where: eq(sopRules.tenantId, tenantId),
    orderBy: [asc(sopRules.name)],
  });

  const activeRules = rules.filter((rule) => rule.isActive);
  const inactiveRules = rules.filter((rule) => !rule.isActive);

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#d6e0eb" }}>SOP Rules</h1>
        <details>
          <summary style={{ listStyle: "none", cursor: "pointer", padding: "8px 12px", fontSize: 13, background: "#2563eb", color: "#fff", border: "none", borderRadius: 6 }}>Add Rule</summary>
          <form action={createRule} style={{ marginTop: 10, background: "#141c24", border: "1px solid #1e2d3d", borderRadius: 8, padding: 14, width: 420, maxWidth: "calc(100vw - 80px)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input name="name" placeholder="Rule name" required style={{ background: "#0b1118", border: "1px solid #253347", color: "#d6e0eb", borderRadius: 6, padding: "8px 10px", fontSize: 13 }} />
              <select name="category" defaultValue={CATEGORIES[0]} style={{ background: "#0b1118", border: "1px solid #253347", color: "#d6e0eb", borderRadius: 6, padding: "8px 10px", fontSize: 13 }}>
                {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
              <textarea name="ruleText" placeholder="Rule text" required rows={4} style={{ background: "#0b1118", border: "1px solid #253347", color: "#d6e0eb", borderRadius: 6, padding: "8px 10px", fontSize: 13, resize: "vertical" }} />
              <label style={{ fontSize: 13, color: "#a8bdd4", display: "flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" name="requireApproval" /> Require approval
              </label>
              <button type="submit" style={{ padding: "9px 12px", fontSize: 13, background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
                Save
              </button>
            </div>
          </form>
        </details>
      </div>

      <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 14, color: "#7f92a8", textTransform: "uppercase", letterSpacing: "0.5px" }}>Active Rules ({activeRules.length})</h2>
        {activeRules.length ? activeRules.map((rule) => <RuleCard key={rule.id} rule={rule} />) : <div style={{ color: "#4a5e75", fontSize: 13 }}>No active rules.</div>}
      </section>

      <details>
        <summary style={{ cursor: "pointer", color: "#7f92a8", fontSize: 14, fontWeight: 600 }}>Inactive Rules ({inactiveRules.length})</summary>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
          {inactiveRules.length ? inactiveRules.map((rule) => <RuleCard key={rule.id} rule={rule} />) : <div style={{ color: "#4a5e75", fontSize: 13 }}>No inactive rules.</div>}
        </div>
      </details>
    </div>
  );
}
