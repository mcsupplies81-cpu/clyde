"use client";

import { useState } from "react";
import { generateNewInviteAction, updateTenantAdminAction } from "./actions";

type Tenant = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  seatLimit: number;
  trialEndsAt: Date | null;
  notes: string | null;
  contactEmail: string | null;
  createdAt: Date;
};

type Props = {
  tenant: Tenant;
  emails: number;
  loads: number;
  users: number;
  pendingInvites: number;
};

const PLAN_COLOR: Record<string, string>   = { demo: "#64748B", pilot: "#FBBF24", paid: "#34D399", churned: "#EF4444" };
const STATUS_COLOR: Record<string, string> = { active: "#34D399", trial: "#FBBF24", inactive: "#64748B", churned: "#EF4444" };

function daysUntil(d: Date | null) {
  if (!d) return null;
  const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
  return diff;
}

export function TenantCard({ tenant, emails, loads, users, pendingInvites }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied]       = useState(false);
  const [saving, setSaving]       = useState(false);

  const trialDays = daysUntil(tenant.trialEndsAt);
  const isTrialExpired = trialDays !== null && trialDays < 0;
  const isTrialSoon    = trialDays !== null && trialDays >= 0 && trialDays <= 7;

  async function handleNewInvite() {
    const res = await generateNewInviteAction(tenant.id);
    if (res.inviteUrl) setInviteUrl(res.inviteUrl);
  }

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    fd.append("tenantId", tenant.id);
    await updateTenantAdminAction(fd);
    setSaving(false);
  }

  function copyInvite() {
    if (inviteUrl) {
      navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div style={{ background: "#1E293B", borderRadius: 10, overflow: "hidden", border: "1px solid #334155" }}>
      {/* Main row */}
      <div
        style={{ padding: "14px 16px", cursor: "pointer", display: "flex", gap: 12, alignItems: "flex-start" }}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Left */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#F1F5F9" }}>{tenant.name}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: PLAN_COLOR[tenant.plan] ?? "#94A3B8", background: "#0F172A", padding: "1px 7px", borderRadius: 99, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {tenant.plan}
            </span>
            <span style={{ fontSize: 10, fontWeight: 600, color: STATUS_COLOR[tenant.status] ?? "#94A3B8" }}>
              {tenant.status}
            </span>
            {isTrialExpired && <span style={{ fontSize: 10, color: "#EF4444", fontWeight: 700 }}>⚠ Trial expired</span>}
            {isTrialSoon && !isTrialExpired && <span style={{ fontSize: 10, color: "#FBBF24", fontWeight: 700 }}>⏱ {trialDays}d left</span>}
          </div>
          {tenant.contactEmail && (
            <div style={{ fontSize: 11, color: "#64748B" }}>{tenant.contactEmail}</div>
          )}
          {tenant.notes && (
            <div style={{ fontSize: 11, color: "#475569", marginTop: 4, fontStyle: "italic" }}>{tenant.notes}</div>
          )}
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 16, flexShrink: 0, fontSize: 12, color: "#64748B" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontWeight: 700, color: "#F1F5F9" }}>{emails}</div>
            <div>emails</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontWeight: 700, color: "#F1F5F9" }}>{loads}</div>
            <div>loads</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontWeight: 700, color: "#F1F5F9" }}>{users}/{tenant.seatLimit}</div>
            <div>seats</div>
          </div>
        </div>

        <div style={{ color: "#334155", fontSize: 12, marginTop: 2 }}>{expanded ? "▲" : "▼"}</div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ borderTop: "1px solid #334155", padding: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

            {/* Edit form */}
            <form onSubmit={handleUpdate} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={fieldStyle}>
                <label style={labelStyle}>Plan</label>
                <select name="plan" defaultValue={tenant.plan} style={inputStyle}>
                  <option value="demo">Demo</option>
                  <option value="pilot">Pilot</option>
                  <option value="paid">Paid</option>
                  <option value="churned">Churned</option>
                </select>
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Status</label>
                <select name="status" defaultValue={tenant.status} style={inputStyle}>
                  <option value="trial">Trial</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="churned">Churned</option>
                </select>
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Seat limit</label>
                <input name="seatLimit" type="number" min="1" defaultValue={tenant.seatLimit} style={inputStyle} />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Notes</label>
                <textarea name="notes" defaultValue={tenant.notes ?? ""} rows={3} style={{ ...inputStyle, resize: "vertical" as const, fontFamily: "inherit" }} />
              </div>
              <button type="submit" disabled={saving} style={saveBtnStyle}>
                {saving ? "Saving…" : "Save changes"}
              </button>
            </form>

            {/* Info + invite */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ background: "#0F172A", borderRadius: 8, padding: 12, fontSize: 11 }}>
                <div style={{ color: "#64748B", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Account details</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <Row label="Tenant ID" value={tenant.id.slice(0, 8) + "…"} />
                  <Row label="Slug" value={tenant.slug} />
                  <Row label="Created" value={new Date(tenant.createdAt).toLocaleDateString()} />
                  <Row label="Trial ends" value={tenant.trialEndsAt ? new Date(tenant.trialEndsAt).toLocaleDateString() : "—"} />
                  <Row label="Pending invites" value={String(pendingInvites)} />
                </div>
              </div>

              {/* Invite link */}
              <div>
                <button onClick={handleNewInvite} style={inviteBtnStyle}>
                  Generate new invite link
                </button>
                {inviteUrl && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 6, padding: "8px 10px", fontSize: 10, fontFamily: "monospace", color: "#7DD3FC", wordBreak: "break-all", marginBottom: 8 }}>
                      {inviteUrl}
                    </div>
                    <button onClick={copyInvite} style={{ ...inviteBtnStyle, background: copied ? "#166534" : "#134E4A", color: copied ? "#86EFAC" : "#2DD4BF" }}>
                      {copied ? "✓ Copied!" : "Copy link"}
                    </button>
                  </div>
                )}
              </div>

              {/* View as tenant */}
              <a
                href={`/app/inbox`}
                style={{ fontSize: 11, color: "#64748B", textDecoration: "none", display: "block", textAlign: "center", padding: "8px", border: "1px solid #334155", borderRadius: 6 }}
              >
                → View app (your account)
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
      <span style={{ color: "#64748B" }}>{label}</span>
      <span style={{ color: "#CBD5E1", fontFamily: "monospace" }}>{value}</span>
    </div>
  );
}

const fieldStyle: React.CSSProperties  = { display: "flex", flexDirection: "column", gap: 4 };
const labelStyle: React.CSSProperties  = { fontSize: 10, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.4px" };
const inputStyle: React.CSSProperties  = { background: "#0F172A", border: "1px solid #334155", borderRadius: 6, color: "#F8FAFC", padding: "7px 10px", fontSize: 12, outline: "none", width: "100%", boxSizing: "border-box" };
const saveBtnStyle: React.CSSProperties = { background: "#2563EB", color: "#FFF", border: "none", borderRadius: 6, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" };
const inviteBtnStyle: React.CSSProperties = { width: "100%", background: "#1E3A5F", color: "#60A5FA", border: "1px solid #1D4ED8", borderRadius: 6, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" };
