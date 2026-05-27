"use client";

import { useState, useActionState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────

type RiskRule = {
  id: string;
  label: string;
  ruleType: "customer" | "rate_threshold" | "equipment" | "lane";
  matchValue: string;
  operator: string | null;
  riskLevel: string;
  priority: number;
  isActive: boolean;
};

type ActionResult = { ok?: boolean; error?: string } | undefined;

// ── Constants ──────────────────────────────────────────────────────────────────

const RULE_TYPE_LABELS: Record<string, string> = {
  customer:        "Customer name",
  rate_threshold:  "Rate ($)",
  equipment:       "Equipment type",
  lane:            "Lane / state",
};

const RULE_TYPE_HINTS: Record<string, string> = {
  customer:        "Substring match on customer name, e.g. \"Acme Foods\"",
  rate_threshold:  "Rate in dollars, e.g. \"3000\" with operator ≥ or ≤",
  equipment:       "Substring match on equipment type, e.g. \"Reefer\"",
  lane:            "State abbreviation, e.g. \"TX\" matches origin or destination",
};

const RISK_LEVEL_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  low:      { bg: "#F0FDF4", text: "#16A34A", border: "#D1FAE5" },
  medium:   { bg: "#FFFBEB", text: "#D97706", border: "#FDE68A" },
  high:     { bg: "#FFF7ED", text: "#EA580C", border: "#FDBA74" },
  critical: { bg: "#FEF2F2", text: "#DC2626", border: "#FECACA" },
};

// ── Preset templates ───────────────────────────────────────────────────────────

const PRESET_RULES: Array<Omit<RiskRule, "id" | "isActive" | "operator"> & { operator: string }> = [
  { label: "High-value loads (≥ $3,000)",      ruleType: "rate_threshold", matchValue: "3000", operator: "gte", riskLevel: "high",     priority: 10 },
  { label: "Critical loads (≥ $5,000)",         ruleType: "rate_threshold", matchValue: "5000", operator: "gte", riskLevel: "critical", priority: 5  },
  { label: "Reefer loads always high risk",      ruleType: "equipment",      matchValue: "Reefer", operator: "contains", riskLevel: "high", priority: 20 },
  { label: "Texas lane — elevated risk",         ruleType: "lane",           matchValue: "TX",   operator: "eq",       riskLevel: "high",     priority: 30 },
];

// ── Add rule form ──────────────────────────────────────────────────────────────

function AddRiskRuleForm({
  onSave,
  onCancel,
  saving,
  error,
}: {
  onSave: (fd: FormData) => void;
  onCancel: () => void;
  saving: boolean;
  error?: string;
}) {
  const [ruleType, setRuleType] = useState<string>("customer");

  return (
    <div style={{ background: "#FFF7ED", border: "1px solid #FDBA74", borderRadius: 8, padding: 16 }}>
      <form action={(fd) => onSave(fd)} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Label + priority row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 80px", gap: 8 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={labelStyle}>Rule label</label>
            <input name="label" required placeholder="e.g. Acme Foods — always hot" style={inputStyle} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={labelStyle}>Priority</label>
            <input name="priority" type="number" defaultValue={0} min={0} style={inputStyle} />
          </div>
        </div>

        {/* Type + match value + operator */}
        <div style={{ display: "grid", gridTemplateColumns: "160px 1fr auto", gap: 8, alignItems: "end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={labelStyle}>Rule type</label>
            <select name="ruleType" value={ruleType} onChange={(e) => setRuleType(e.target.value)} style={inputStyle}>
              {Object.entries(RULE_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={labelStyle}>
              Match value
              <span style={{ fontWeight: 400, color: "#B0B0B0", marginLeft: 6 }}>{RULE_TYPE_HINTS[ruleType]}</span>
            </label>
            <input
              name="matchValue"
              required
              placeholder={ruleType === "rate_threshold" ? "e.g. 3000" : ruleType === "lane" ? "e.g. TX" : "e.g. Acme Foods"}
              style={inputStyle}
            />
          </div>

          {ruleType === "rate_threshold" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={labelStyle}>Operator</label>
              <select name="operator" style={{ ...inputStyle, width: 70 }}>
                <option value="gte">≥</option>
                <option value="lte">≤</option>
              </select>
            </div>
          )}
          {ruleType !== "rate_threshold" && <input type="hidden" name="operator" value="contains" />}
        </div>

        {/* Risk level */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={labelStyle}>Assign risk level</label>
          <div style={{ display: "flex", gap: 6 }}>
            {(["low", "medium", "high", "critical"] as const).map((level) => {
              const colors = RISK_LEVEL_COLORS[level];
              return (
                <label key={level} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                  <input type="radio" name="riskLevel" value={level} defaultChecked={level === "high"} style={{ accentColor: colors.text }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: colors.text, background: colors.bg, border: `1px solid ${colors.border}`, padding: "2px 8px", borderRadius: 4 }}>
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {error && <div style={{ fontSize: 12, color: "#DC2626" }}>{error}</div>}

        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" disabled={saving} style={{ ...btnStyle, background: "#EA580C", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Saving…" : "Add risk rule"}
          </button>
          <button type="button" onClick={onCancel} style={cancelBtnStyle}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

// ── Risk rule card ──────────────────────────────────────────────────────────────

function RiskRuleCard({
  rule,
  toggleAction,
  deleteAction,
}: {
  rule: RiskRule;
  toggleAction: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
  deleteAction: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
}) {
  const [, toggleFormAction] = useActionState<ActionResult, FormData>(toggleAction, undefined);
  const [, deleteFormAction] = useActionState<ActionResult, FormData>(deleteAction, undefined);

  const colors = RISK_LEVEL_COLORS[rule.riskLevel] ?? RISK_LEVEL_COLORS.high;
  const typeLabel = RULE_TYPE_LABELS[rule.ruleType] ?? rule.ruleType;

  const matchDesc =
    rule.ruleType === "rate_threshold"
      ? `Rate ${rule.operator === "lte" ? "≤" : "≥"} $${Number(rule.matchValue).toLocaleString()}`
      : rule.ruleType === "lane"
      ? `State = ${rule.matchValue.toUpperCase()}`
      : `"${rule.matchValue}"`;

  return (
    <div style={{
      background: "#FFFFFF",
      border: "1px solid #EBEBEB",
      borderRadius: 8,
      padding: "10px 14px",
      opacity: rule.isActive ? 1 : 0.5,
      display: "flex",
      gap: 12,
      alignItems: "center",
    }}>
      {/* Active dot */}
      <div style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: rule.isActive ? colors.text : "#D1D5DB" }} />

      {/* Rule info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" as const, marginBottom: 2 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#1A1A1A" }}>{rule.label}</span>
          <span style={{
            fontSize: 10, fontWeight: 700, color: colors.text,
            background: colors.bg, border: `1px solid ${colors.border}`,
            padding: "1px 7px", borderRadius: 4,
          }}>
            {rule.riskLevel.toUpperCase()}
          </span>
        </div>
        <div style={{ fontSize: 11, color: "#9CA3AF" }}>
          <span style={{ color: "#6B7280", fontWeight: 500 }}>{typeLabel}:</span> {matchDesc}
          <span style={{ color: "#D1D5DB", margin: "0 6px" }}>·</span>
          priority {rule.priority}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
        <form action={toggleFormAction}>
          <input type="hidden" name="id"       value={rule.id} />
          <input type="hidden" name="isActive" value={String(rule.isActive)} />
          <button type="submit" style={ghostBtnStyle}>{rule.isActive ? "Disable" : "Enable"}</button>
        </form>
        <form action={deleteFormAction}>
          <input type="hidden" name="id" value={rule.id} />
          <button
            type="submit"
            style={{ ...ghostBtnStyle, color: "#DC2626", borderColor: "#FECACA" }}
            onClick={(e) => { if (!confirm("Delete this risk rule?")) e.preventDefault(); }}
          >
            ×
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function RiskRulesSection({
  rules,
  createAction,
  toggleAction,
  deleteAction,
}: {
  rules: RiskRule[];
  createAction: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
  toggleAction: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
  deleteAction: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [createResult, createFormAction, creating] = useActionState<ActionResult, FormData>(createAction, undefined);

  const createError = createResult && "error" in createResult ? createResult.error : undefined;

  const activeRules   = rules.filter((r) => r.isActive).sort((a, b) => a.priority - b.priority);
  const inactiveRules = rules.filter((r) => !r.isActive);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Section header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#1A1A1A" }}>Risk Rules</div>
          <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
            Auto-assign risk levels to loads by customer, rate, equipment type, or lane.
            Rules run in priority order — lower number wins.
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            onClick={() => { setShowPresets(!showPresets); setShowForm(false); }}
            style={{
              padding: "6px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer", borderRadius: 5,
              background: showPresets ? "#FFF7ED" : "#F5F5F5",
              color: showPresets ? "#EA580C" : "#5D5D5D",
              border: `1px solid ${showPresets ? "#FDBA74" : "#E8E8E8"}`,
            }}
          >
            ✦ Presets
          </button>
          <button
            type="button"
            onClick={() => { setShowForm(!showForm); setShowPresets(false); }}
            style={{
              padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", borderRadius: 5,
              background: showForm ? "#C2410C" : "#EA580C",
              color: "#FFFFFF",
              border: "none",
            }}
          >
            {showForm ? "Cancel" : "+ Add rule"}
          </button>
        </div>
      </div>

      {/* Default heuristic reminder */}
      <div style={{ fontSize: 11, color: "#9CA3AF", background: "#F9FAFB", border: "1px solid #F0F0F0", borderRadius: 6, padding: "7px 10px" }}>
        <span style={{ fontWeight: 600, color: "#6B7280" }}>Default (no rules match):</span> Rate ≥ $3,000 → <strong>High</strong> · Rate ≥ $2,000 → <strong>Medium</strong> · else → <strong>Low</strong>
      </div>

      {/* Preset templates */}
      {showPresets && (
        <div style={{ background: "#FFF7ED", border: "1px solid #FDBA74", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid #FDE68A", fontSize: 12, fontWeight: 700, color: "#EA580C" }}>
            ✦ Quick-start presets
          </div>
          {PRESET_RULES.map((preset, i) => {
            const alreadyAdded = rules.some((r) => r.matchValue === preset.matchValue && r.ruleType === preset.ruleType);
            return (
              <form key={i} action={createFormAction}>
                <input type="hidden" name="label"      value={preset.label} />
                <input type="hidden" name="ruleType"   value={preset.ruleType} />
                <input type="hidden" name="matchValue" value={preset.matchValue} />
                <input type="hidden" name="operator"   value={preset.operator} />
                <input type="hidden" name="riskLevel"  value={preset.riskLevel} />
                <input type="hidden" name="priority"   value={String(preset.priority)} />
                <button
                  type="submit"
                  disabled={alreadyAdded}
                  style={{
                    width: "100%", textAlign: "left", background: "transparent", border: "none",
                    borderTop: i > 0 ? "1px solid #FEF3C7" : "none",
                    padding: "9px 14px", cursor: alreadyAdded ? "default" : "pointer",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    opacity: alreadyAdded ? 0.4 : 1,
                  }}
                >
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#292929" }}>{preset.label}</span>
                    <span style={{ fontSize: 10, color: "#9CA3AF", marginLeft: 8 }}>
                      {RULE_TYPE_LABELS[preset.ruleType]}
                    </span>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: alreadyAdded ? "#9CA3AF" : RISK_LEVEL_COLORS[preset.riskLevel].text,
                    flexShrink: 0,
                  }}>
                    {alreadyAdded ? "✓ Added" : "+ Add"}
                  </span>
                </button>
              </form>
            );
          })}
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <AddRiskRuleForm
          onSave={(fd) => { createFormAction(fd); setShowForm(false); }}
          onCancel={() => setShowForm(false)}
          saving={creating}
          error={createError}
        />
      )}

      {/* Active rules list */}
      {activeRules.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {activeRules.map((rule) => (
            <RiskRuleCard key={rule.id} rule={rule} toggleAction={toggleAction} deleteAction={deleteAction} />
          ))}
        </div>
      ) : (
        <div style={{ padding: "24px 0", textAlign: "center", color: "#B0B0B0", fontSize: 12 }}>
          No active risk rules.{" "}
          <button type="button" onClick={() => setShowPresets(true)} style={{ background: "none", border: "none", color: "#EA580C", cursor: "pointer", fontSize: 12, fontWeight: 600, padding: 0 }}>
            Try a preset ↗
          </button>
        </div>
      )}

      {/* Inactive rules */}
      {inactiveRules.length > 0 && (
        <details style={{ marginTop: 4 }}>
          <summary style={{ cursor: "pointer", color: "#9CA3AF", fontSize: 11, fontWeight: 600, userSelect: "none" as const, padding: "2px 0" }}>
            Disabled rules ({inactiveRules.length})
          </summary>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
            {inactiveRules.map((rule) => (
              <RiskRuleCard key={rule.id} rule={rule} toggleAction={toggleAction} deleteAction={deleteAction} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────────

const labelStyle = { fontSize: 11, fontWeight: 600, color: "#5D5D5D" } as const;
const inputStyle = { background: "#FFFFFF", border: "1px solid #E8E8E8", color: "#292929", borderRadius: 6, padding: "7px 10px", fontSize: 12, outline: "none", width: "100%" } as const;
const btnStyle = { padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", background: "#2563EB", color: "#FFFFFF", border: "none", borderRadius: 6 } as const;
const cancelBtnStyle = { padding: "7px 14px", fontSize: 12, cursor: "pointer", background: "transparent", color: "#9CA3AF", border: "1px solid #E8E8E8", borderRadius: 6 } as const;
const ghostBtnStyle = { padding: "4px 9px", fontSize: 11, cursor: "pointer", background: "transparent", color: "#5D5D5D", border: "1px solid #E8E8E8", borderRadius: 5, fontWeight: 500 } as const;
