"use client";

import { useState, useActionState } from "react";
import { CategoryBadge } from "@/components/CategoryBadge";

type Rule = {
  id: string;
  name: string;
  category: string;
  ruleText: string;
  requireApproval: boolean;
  isActive: boolean;
};

type ActionResult = { ok?: boolean; error?: string } | undefined;

// ── Starter templates ──────────────────────────────────────────────────────────
// One-click to add a pre-written SOP — helps users get started fast.

const TEMPLATES: { category: string; name: string; ruleText: string; requireApproval: boolean }[] = [
  // Status updates
  { category: "status_request", name: "Always include load # and location", ruleText: "Always include the load number and current carrier location (last check-in city/state) in every status update reply.", requireApproval: false },
  { category: "status_request", name: "Reply within 4 business hours", ruleText: "All status requests must be acknowledged within 4 business hours. If you cannot provide a full update, reply with an ETA for when you will have more information.", requireApproval: false },
  { category: "status_request", name: "Escalate delayed pickups", ruleText: "If the carrier has not checked in within 2 hours of scheduled pickup time, escalate to the assigned dispatcher before replying to the customer.", requireApproval: true },
  // POD requests
  { category: "pod_request", name: "POD turnaround time", ruleText: "When a POD is requested, advise the customer it will be available within 24 hours of delivery confirmation. If already available, attach or link it directly.", requireApproval: false },
  { category: "pod_request", name: "Verify delivery before replying", ruleText: "Before replying to a POD request, confirm in the TMS that delivery has been marked complete and the POD has been received from the carrier.", requireApproval: false },
  // BOL requests
  { category: "bol_request", name: "Reply within 1 business hour", ruleText: "BOL requests must be fulfilled within 1 business hour during business hours (8am–6pm local). After hours, acknowledge receipt and confirm next-business-day delivery.", requireApproval: false },
  // Quote requests
  { category: "quote_request", name: "Never commit to rate in draft", ruleText: "Never include a specific rate or commitment to pricing in AI-drafted replies to quote requests. All quote responses require human review and approval before sending.", requireApproval: true },
  { category: "quote_request", name: "Confirm lane details in reply", ruleText: "When acknowledging a quote request, repeat back the lane details (origin, destination, commodity, weight, required transit time) to confirm you have the correct information.", requireApproval: false },
  // Appointment changes
  { category: "appointment_change", name: "Confirm both carrier and customer", ruleText: "When an appointment change is requested or made, confirm the change with both the carrier and the customer in separate replies. Never assume the other party has been notified.", requireApproval: true },
  { category: "appointment_change", name: "Document reason for change", ruleText: "All appointment changes must include the reason for the change in the reply and in any internal notes. This is required for carrier scorecards.", requireApproval: false },
  // Detention / accessorial
  { category: "detention_accessorial", name: "Do not approve in draft", ruleText: "Never approve or deny detention/accessorial charges in an AI-drafted reply. Acknowledge receipt and advise that the billing team will follow up. Always require human approval.", requireApproval: true },
];

const CATEGORY_LABELS: Record<string, string> = {
  status_request: "Status Updates",
  pod_request: "POD Requests",
  bol_request: "BOL Requests",
  quote_request: "Quote Requests",
  appointment_change: "Appointment Changes",
  detention_accessorial: "Detention / Accessorial",
  billing_invoice: "Billing / Invoice",
  escalation: "Escalation",
  carrier_checkin: "Carrier Check-in",
  unknown: "Other",
};

// ── Subcomponents ──────────────────────────────────────────────────────────────

function RuleForm({
  rule,
  categories,
  onSave,
  onCancel,
  saving,
  error,
}: {
  rule?: Rule;
  categories: string[];
  onSave: (fd: FormData) => void;
  onCancel: () => void;
  saving: boolean;
  error?: string;
}) {
  return (
    <div style={{ background: "#F8FAFF", border: "1px solid #DBEAFE", borderRadius: 8, padding: 16 }}>
      <form
        action={(fd) => onSave(fd)}
        style={{ display: "flex", flexDirection: "column", gap: 10 }}
      >
        {rule && <input type="hidden" name="id" value={rule.id} />}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={labelStyle}>Rule name</label>
            <input name="name" defaultValue={rule?.name} required placeholder="e.g. Always include load #" style={inputStyle} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={labelStyle}>Category</label>
            <select name="category" defaultValue={rule?.category ?? categories[0]} style={inputStyle}>
              {categories.map((c) => (
                <option key={c} value={c}>{CATEGORY_LABELS[c] ?? c}</option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={labelStyle}>Rule instruction</label>
          <textarea
            name="ruleText"
            defaultValue={rule?.ruleText}
            required
            rows={3}
            placeholder="Write the SOP instruction that Clyde will follow when drafting replies for this category…"
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </div>
        <label style={{ fontSize: 12, color: "#5D5D5D", display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input type="checkbox" name="requireApproval" defaultChecked={rule?.requireApproval} />
          Require human approval before sending (recommended for financial or sensitive replies)
        </label>
        {error && <div style={{ fontSize: 12, color: "#DC2626" }}>{error}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" disabled={saving} style={{ ...btnStyle, opacity: saving ? 0.6 : 1 }}>
            {saving ? "Saving…" : rule ? "Save changes" : "Add rule"}
          </button>
          <button type="button" onClick={onCancel} style={cancelBtnStyle}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

function RuleCard({
  rule,
  categories,
  updateAction,
  toggleAction,
  deleteAction,
}: {
  rule: Rule;
  categories: string[];
  updateAction: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
  toggleAction: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
  deleteAction: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
}) {
  const [editing, setEditing] = useState(false);
  const [updateResult, updateFormAction, updating] = useActionState<ActionResult, FormData>(updateAction, undefined);
  const [, toggleFormAction] = useActionState<ActionResult, FormData>(toggleAction, undefined);
  const [, deleteFormAction] = useActionState<ActionResult, FormData>(deleteAction, undefined);

  const updateError = updateResult && "error" in updateResult ? updateResult.error : undefined;

  if (editing) {
    return (
      <RuleForm
        rule={rule}
        categories={categories}
        onSave={(fd) => { updateFormAction(fd); setEditing(false); }}
        onCancel={() => setEditing(false)}
        saving={updating}
        error={updateError}
      />
    );
  }

  return (
    <div style={{
      background: "#FFFFFF",
      border: "1px solid #EBEBEB",
      borderRadius: 8,
      padding: "12px 14px",
      opacity: rule.isActive ? 1 : 0.55,
      display: "flex",
      gap: 12,
      alignItems: "flex-start",
    }}>
      {/* Active indicator dot */}
      <div style={{
        width: 8, height: 8, borderRadius: "50%", flexShrink: 0, marginTop: 5,
        background: rule.isActive ? "#16A34A" : "#D1D5DB",
      }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" as const, marginBottom: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#1A1A1A" }}>{rule.name}</span>
          {rule.requireApproval && (
            <span style={{ fontSize: 10, fontWeight: 600, color: "#D97706", background: "#FFFBEB", border: "1px solid #FDE68A", padding: "1px 6px", borderRadius: 4 }}>
              Approval required
            </span>
          )}
        </div>
        <p style={{ margin: 0, fontSize: 12, color: "#5D5D5D", lineHeight: 1.6 }}>{rule.ruleText}</p>
      </div>

      <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
        <button type="button" onClick={() => setEditing(true)} style={ghostBtnStyle}>Edit</button>
        <form action={toggleFormAction} style={{ margin: 0 }}>
          <input type="hidden" name="id" value={rule.id} />
          <input type="hidden" name="isActive" value={String(rule.isActive)} />
          <button type="submit" style={ghostBtnStyle}>{rule.isActive ? "Disable" : "Enable"}</button>
        </form>
        <form action={deleteFormAction} style={{ margin: 0 }}>
          <input type="hidden" name="id" value={rule.id} />
          <button
            type="submit"
            style={{ ...ghostBtnStyle, color: "#DC2626", borderColor: "#FECACA" }}
            onClick={(e) => { if (!confirm("Delete this rule?")) e.preventDefault(); }}
          >
            ×
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Main client component ──────────────────────────────────────────────────────

export function RulesClient({
  rules,
  categories,
  createAction,
  updateAction,
  toggleAction,
  deleteAction,
}: {
  rules: Rule[];
  categories: string[];
  createAction: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
  updateAction: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
  toggleAction: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
  deleteAction: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateCategory, setTemplateCategory] = useState<string>("all");
  const [createResult, createFormAction, creating] = useActionState<ActionResult, FormData>(createAction, undefined);

  const createError = createResult && "error" in createResult ? createResult.error : undefined;

  const activeRules   = rules.filter((r) => r.isActive);
  const inactiveRules = rules.filter((r) => !r.isActive);

  // Group active rules by category
  const grouped = categories.reduce<Record<string, Rule[]>>((acc, cat) => {
    const catRules = activeRules.filter((r) => r.category === cat);
    if (catRules.length) acc[cat] = catRules;
    return acc;
  }, {});

  const filteredTemplates = TEMPLATES.filter(
    (t) => templateCategory === "all" || t.category === templateCategory
  );

  return (
    <div style={{ padding: 24, background: "#FAFAF8", minHeight: "100%", display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#1A1A1A", letterSpacing: "-0.5px" }}>SOPs & Rules</h1>
          <div style={{ color: "#9CA3AF", fontSize: 12, marginTop: 4 }}>
            Instructions Clyde follows when drafting replies — your brokerage&apos;s standard operating procedures
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => { setShowTemplates(!showTemplates); setShowForm(false); }}
            style={{
              padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", borderRadius: 6,
              background: showTemplates ? "#EFF6FF" : "#F5F5F5",
              color: showTemplates ? "#2563EB" : "#5D5D5D",
              border: `1px solid ${showTemplates ? "#BFDBFE" : "#E8E8E8"}`,
            }}
          >
            ✦ Starter templates
          </button>
          <button
            type="button"
            onClick={() => { setShowForm(!showForm); setShowTemplates(false); }}
            style={{ ...btnStyle, background: showForm ? "#1D4ED8" : "#2563EB" }}
          >
            {showForm ? "Cancel" : "+ Add rule"}
          </button>
        </div>
      </div>

      {/* Inline add form */}
      {showForm && (
        <RuleForm
          categories={categories}
          onSave={(fd) => { createFormAction(fd); setShowForm(false); }}
          onCancel={() => setShowForm(false)}
          saving={creating}
          error={createError}
        />
      )}

      {/* Starter templates panel */}
      {showTemplates && (
        <div style={{ background: "#FFFFFF", border: "1px solid #DBEAFE", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", background: "#EFF6FF", borderBottom: "1px solid #DBEAFE", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1D4ED8" }}>✦ Starter templates</div>
              <div style={{ fontSize: 11, color: "#60A5FA", marginTop: 2 }}>Click any to add it instantly — you can edit it after</div>
            </div>
            {/* Category filter */}
            <select
              value={templateCategory}
              onChange={(e) => setTemplateCategory(e.target.value)}
              style={{ ...inputStyle, width: "auto", fontSize: 11 }}
            >
              <option value="all">All categories</option>
              {categories.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c] ?? c}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {filteredTemplates.map((t, i) => {
              const alreadyAdded = rules.some((r) => r.ruleText === t.ruleText);
              return (
                <form key={i} action={createFormAction}>
                  <input type="hidden" name="name" value={t.name} />
                  <input type="hidden" name="category" value={t.category} />
                  <input type="hidden" name="ruleText" value={t.ruleText} />
                  {t.requireApproval && <input type="hidden" name="requireApproval" value="on" />}
                  <button
                    type="submit"
                    disabled={alreadyAdded}
                    style={{
                      width: "100%", textAlign: "left", background: "transparent", border: "none",
                      borderTop: i > 0 ? "1px solid #F2F2F2" : "none",
                      padding: "10px 16px", cursor: alreadyAdded ? "default" : "pointer",
                      display: "flex", alignItems: "flex-start", gap: 12,
                      opacity: alreadyAdded ? 0.45 : 1,
                    }}
                  >
                    <div style={{ flex: 1, textAlign: "left" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 3 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#292929" }}>{t.name}</span>
                        <span style={{ fontSize: 10, color: "#9CA3AF" }}>{CATEGORY_LABELS[t.category] ?? t.category}</span>
                        {t.requireApproval && (
                          <span style={{ fontSize: 10, color: "#D97706", background: "#FFFBEB", border: "1px solid #FDE68A", padding: "1px 5px", borderRadius: 3 }}>approval required</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: "#5D5D5D", lineHeight: 1.5 }}>{t.ruleText}</div>
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: alreadyAdded ? "#9CA3AF" : "#2563EB", flexShrink: 0, paddingTop: 2 }}>
                      {alreadyAdded ? "✓ Added" : "+ Add"}
                    </div>
                  </button>
                </form>
              );
            })}
          </div>
        </div>
      )}

      {/* Active rules — grouped by category */}
      {activeRules.length > 0 ? (
        Object.entries(grouped).map(([cat, catRules]) => (
          <div key={cat} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CategoryBadge category={cat} />
              <span style={{ fontSize: 11, color: "#9CA3AF" }}>{catRules.length} rule{catRules.length !== 1 ? "s" : ""}</span>
            </div>
            {catRules.map((rule) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                categories={categories}
                updateAction={updateAction}
                toggleAction={toggleAction}
                deleteAction={deleteAction}
              />
            ))}
          </div>
        ))
      ) : (
        <div style={{ padding: "40px 0", textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
          No active rules yet.{" "}
          <button type="button" onClick={() => setShowTemplates(true)} style={{ background: "none", border: "none", color: "#2563EB", cursor: "pointer", fontSize: 13, fontWeight: 600, padding: 0 }}>
            Start with a template ↗
          </button>
        </div>
      )}

      {/* Inactive rules — collapsed */}
      {inactiveRules.length > 0 && (
        <details>
          <summary style={{ cursor: "pointer", color: "#9CA3AF", fontSize: 12, fontWeight: 600, userSelect: "none" as const, padding: "4px 0" }}>
            Disabled rules ({inactiveRules.length})
          </summary>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
            {inactiveRules.map((rule) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                categories={categories}
                updateAction={updateAction}
                toggleAction={toggleAction}
                deleteAction={deleteAction}
              />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const labelStyle = { fontSize: 11, fontWeight: 600, color: "#5D5D5D" } as const;
const inputStyle = { background: "#FFFFFF", border: "1px solid #E8E8E8", color: "#292929", borderRadius: 6, padding: "7px 10px", fontSize: 12, outline: "none", width: "100%" } as const;
const btnStyle = { padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", background: "#2563EB", color: "#FFFFFF", border: "none", borderRadius: 6 } as const;
const cancelBtnStyle = { padding: "7px 14px", fontSize: 12, cursor: "pointer", background: "transparent", color: "#9CA3AF", border: "1px solid #E8E8E8", borderRadius: 6 } as const;
const ghostBtnStyle = { padding: "5px 10px", fontSize: 11, cursor: "pointer", background: "transparent", color: "#5D5D5D", border: "1px solid #E8E8E8", borderRadius: 5, fontWeight: 500 } as const;
