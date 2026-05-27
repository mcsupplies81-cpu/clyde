import type { CSSProperties } from "react";
import { revalidatePath } from "next/cache";
import { createHash, randomBytes } from "crypto";
import { db } from "@/db";
import { inboxConnections, inboxes, tenants, apiKeys } from "@/db/schema";
import { and, asc, desc, eq } from "drizzle-orm";
import { AiSettingsClient } from "./AiSettingsClient";
import { AutopilotClient } from "./AutopilotClient";
import { ApiKeySection } from "./ApiKeySection";

const timezones = ["UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Europe/London"];

async function disconnectGmail(formData: FormData) {
  "use server";
  const tenantId = String(formData.get("tenantId") ?? "");
  if (!tenantId) return;
  await db.delete(inboxConnections).where(and(eq(inboxConnections.tenantId, tenantId), eq(inboxConnections.provider, "gmail")));
  revalidatePath("/app/settings");
}

async function updateTenantName(formData: FormData) {
  "use server";
  const tenantId = process.env.DEMO_TENANT_ID ?? "";
  const name = String(formData.get("name") ?? "").trim();
  if (!tenantId || !name) return;
  await db.update(tenants).set({ name }).where(eq(tenants.id, tenantId));
  revalidatePath("/app/settings");
}

async function createApiKeyAction(_prev: unknown, formData: FormData) {
  "use server";
  const tenantId = process.env.DEMO_TENANT_ID ?? "";
  const name = String(formData.get("keyName") ?? "").trim();
  if (!tenantId || !name) return { error: "Missing name" };

  const raw    = "clyde_live_" + randomBytes(24).toString("hex");
  const hash   = createHash("sha256").update(raw).digest("hex");
  const prefix = raw.slice(0, 18) + "…";

  await db.insert(apiKeys).values({ tenantId, name, keyHash: hash, keyPrefix: prefix });
  revalidatePath("/app/settings");
  return { key: raw, prefix, name };
}

async function revokeApiKeyAction(_prev: unknown, formData: FormData) {
  "use server";
  const tenantId = process.env.DEMO_TENANT_ID ?? "";
  const keyId = String(formData.get("keyId") ?? "");
  if (!tenantId || !keyId) return { error: "Missing params" };

  await db.update(apiKeys)
    .set({ isActive: false })
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.tenantId, tenantId)));
  revalidatePath("/app/settings");
  return { ok: true };
}

export default async function SettingsPage() {
  const tenantId  = process.env.DEMO_TENANT_ID ?? "";
  const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://clyde-app.vercel.app";

  const [tenant, demoInbox, gmailConnection, existingKeys] = await Promise.all([
    tenantId ? db.query.tenants.findFirst({ where: eq(tenants.id, tenantId) }) : null,
    tenantId ? db.query.inboxes.findFirst({ where: and(eq(inboxes.tenantId, tenantId)), orderBy: [asc(inboxes.createdAt)] }) : null,
    tenantId ? db.query.inboxConnections.findFirst({
      where: and(eq(inboxConnections.tenantId, tenantId), eq(inboxConnections.provider, "gmail")),
      orderBy: [desc(inboxConnections.createdAt)],
    }) : null,
    tenantId ? db.query.apiKeys.findMany({
      where: and(eq(apiKeys.tenantId, tenantId), eq(apiKeys.isActive, true)),
      orderBy: [desc(apiKeys.createdAt)],
    }) : [],
  ]);

  return (
    <div style={{ padding: 24, background: "#FAFAF8", minHeight: "100%" }}>
      <h1 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700, color: "#292929", letterSpacing: "-0.5px" }}>Settings</h1>
      <div style={{ display: "grid", gap: 14, maxWidth: 720 }}>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Company Profile</h2>
          <form action={updateTenantName} style={rowStyle}>
            <div>
              <div style={labelStyle}>Company name</div>
              <div style={subtleStyle}>Displayed across the app</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input name="name" defaultValue={tenant?.name ?? ""} style={inputStyle} />
              <button type="submit" style={buttonStyle}>Save</button>
            </div>
          </form>

          <div style={rowStyle}>
            <div>
              <div style={labelStyle}>Demo inbox address</div>
              <div style={subtleStyle}>From inboxes table</div>
            </div>
            <code style={codeStyle}>{demoInbox?.emailAddress ?? "No inbox found"}</code>
          </div>

          <div style={rowStyle}>
            <div>
              <div style={labelStyle}>Timezone</div>
              <div style={subtleStyle}>Timestamps displayed in this timezone</div>
            </div>
            <select style={inputStyle} defaultValue="America/Chicago">
              {timezones.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>AI Settings</h2>
          <AiSettingsClient />
          <div style={rowStyle}>
            <div style={labelStyle}>Model</div>
            <code style={codeStyle}>{hasOpenAiKey ? "gpt-4o-mini" : "Mock classifier (keyword-based)"}</code>
          </div>
          <div style={rowStyle}>
            <div style={labelStyle}>OpenAI key</div>
            <div style={{
              ...pillStyle,
              background: hasOpenAiKey ? "#F0FDF4" : "#FFF7ED",
              color: hasOpenAiKey ? "#16A34A" : "#EA580C",
            }}>
              {hasOpenAiKey ? "Connected" : "Not configured — using mock"}
            </div>
          </div>
          <div style={rowStyle}>
            <div style={labelStyle}>Human approval</div>
            <div style={{ ...pillStyle, background: "#F9FAFB", color: "#7F7F7F" }}>Always required</div>
          </div>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Forwarding Inbox</h2>
          <p style={{ margin: "0 0 14px", fontSize: 12, color: "#7F7F7F", lineHeight: 1.6 }}>
            Forward any email to your unique Clyde address — works with Outlook, Gmail, or any email client.
            Clyde will classify it, match it to a load, and draft a reply automatically.
          </p>

          {/* Inbound address */}
          <div style={{ ...rowStyle, flexWrap: "wrap" as const, gap: 10 }}>
            <div>
              <div style={labelStyle}>Your Clyde inbox address</div>
              <div style={subtleStyle}>Set this as your forwarding destination</div>
            </div>
            <code style={{ ...codeStyle, fontSize: 12, background: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE", padding: "6px 12px" }}>
              {demoInbox?.emailAddress ?? "—"}
            </code>
          </div>

          {/* Setup steps */}
          <div style={{ borderTop: "1px solid #F2F2F2", paddingTop: 14, marginTop: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase" as const, letterSpacing: "0.5px", marginBottom: 10 }}>
              Setup (30 seconds)
            </div>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
              {[
                { step: "1", label: "Outlook", detail: "Settings → Mail → Forwarding → Add forwarding address above" },
                { step: "2", label: "Gmail", detail: "Settings → Forwarding and POP/IMAP → Add a forwarding address" },
                { step: "3", label: "Any client", detail: "Set up an auto-forward rule: From = anyone, To = your ops address, Forward to Clyde" },
              ].map(({ step, label, detail }) => (
                <div key={step} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#EFF6FF", border: "1px solid #BFDBFE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#2563EB", flexShrink: 0, marginTop: 1 }}>{step}</div>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#292929" }}>{label}: </span>
                    <span style={{ fontSize: 12, color: "#7F7F7F" }}>{detail}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Webhook info */}
          <details style={{ borderTop: "1px solid #F2F2F2", paddingTop: 10, marginTop: 10 }}>
            <summary style={{ cursor: "pointer", fontSize: 12, color: "#2563EB", fontWeight: 600, userSelect: "none" as const }}>
              Developer: webhook endpoint ↓
            </summary>
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, color: "#7F7F7F", marginBottom: 6 }}>
                Using Postmark, Mailgun, or SendGrid inbound parse? POST to:
              </div>
              <code style={{ ...codeStyle, fontSize: 11, display: "block", padding: "8px 12px" }}>
                POST {baseUrl}/api/webhooks/inbound-email
              </code>
              <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 6 }}>
                Set header <code>x-webhook-secret</code> = <code>INBOUND_WEBHOOK_SECRET</code> env var.
                Postmark inbound format supported out of the box.
              </div>
            </div>
          </details>
        </section>

        {/* TMS / CRM Integration API */}
        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>TMS / CRM Integration</h2>
          <div style={{ padding: "8px 0 14px", borderBottom: "1px solid #F2F2F2" }}>
            <p style={{ margin: "0 0 8px", fontSize: 13, color: "#3D3D3D", lineHeight: 1.6 }}>
              Push load data from any TMS, CRM, or tracking system into Clyde via one universal API endpoint.
              No per-integration setup — if your system can send a webhook or HTTP request, it works.
            </p>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" as const }}>
              <code style={{ ...codeStyle, fontSize: 12 }}>POST {baseUrl}/api/v1/loads</code>
              <span style={{ fontSize: 11, color: "#9CA3AF" }}>Bearer token auth</span>
            </div>
          </div>

          {/* Supported / compatible systems */}
          <div style={rowStyle}>
            <div>
              <div style={labelStyle}>Compatible with</div>
              <div style={subtleStyle}>Any system that can send HTTP POST requests</div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
              {["Rose Rocket", "McLeod", "Turvo", "Aljex", "TMW", "Zapier", "Make"].map((s) => (
                <span key={s} style={{ fontSize: 10, fontWeight: 600, color: "#5D5D5D", background: "#F5F5F5", border: "1px solid #E8E8E8", padding: "2px 7px", borderRadius: 4 }}>{s}</span>
              ))}
            </div>
          </div>

          {/* Example payload */}
          <details style={{ borderTop: "1px solid #F2F2F2", paddingTop: 10, marginTop: 2 }}>
            <summary style={{ cursor: "pointer", fontSize: 12, color: "#2563EB", fontWeight: 600, userSelect: "none" as const }}>
              View example payload ↓
            </summary>
            <pre style={{ margin: "10px 0 0", background: "#F8FAFF", border: "1px solid #DBEAFE", borderRadius: 6, padding: "10px 12px", fontSize: 11, color: "#292929", overflow: "auto", lineHeight: 1.6 }}>
{`POST ${baseUrl}/api/v1/loads
Authorization: Bearer clyde_live_...

{
  "loadNumber": "HFB-3421",
  "status": "in_transit",
  "carrier": { "name": "XYZ Trucking", "mc": "MC123456" },
  "customer": { "name": "Home Furnishings B" },
  "origin": { "city": "Dallas", "state": "TX" },
  "destination": { "city": "Nashville", "state": "TN" },
  "pickupAt": "2025-05-26T08:00:00Z",
  "eta": "2025-05-27T17:00:00Z",
  "weightLbs": 44000,
  "commodity": "Dry Van",
  "riskLevel": "normal"
}`}
            </pre>
            <div style={{ marginTop: 8, fontSize: 11, color: "#9CA3AF" }}>
              Also accepts snake_case keys (load_number, carrier_name, origin_city, etc.) — common in TMS webhooks.
              Upserts on loadNumber — safe to call on every status change.
            </div>
          </details>

          {/* API Keys */}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase" as const, letterSpacing: "0.7px", marginBottom: 2 }}>
              API Keys
            </div>
            <ApiKeySection
              existingKeys={existingKeys}
              createAction={createApiKeyAction}
              revokeAction={revokeApiKeyAction}
            />
          </div>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Autopilot</h2>
          <AutopilotClient />
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Demo Tools</h2>
          <div style={rowStyle}>
            <div style={labelStyle}>Re-seed demo data</div>
            <code style={codeStyle}>npm run db:seed</code>
          </div>
          <div style={rowStyle}>
            <div style={labelStyle}>Tenant ID</div>
            <code style={codeStyle}>{tenantId || "DEMO_TENANT_ID not set"}</code>
          </div>
        </section>

      </div>
    </div>
  );
}

const sectionStyle: CSSProperties = { background: "#FFFFFF", border: "1px solid #E8E8E8", borderRadius: 10, padding: 20 };
const sectionTitleStyle: CSSProperties = { margin: "0 0 14px", fontSize: 11, color: "#9CA3AF", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px" };
const rowStyle: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: "10px 0", borderTop: "1px solid #F2F2F2" };
const labelStyle: CSSProperties = { fontSize: 13, color: "#292929", fontWeight: 500 };
const subtleStyle: CSSProperties = { marginTop: 3, fontSize: 11, color: "#9CA3AF" };
const inputStyle: CSSProperties = { background: "#FAFAF8", border: "1px solid #E8E8E8", borderRadius: 6, color: "#292929", padding: "7px 10px", fontSize: 12, outline: "none" };
const buttonStyle: CSSProperties = { background: "#2563EB", color: "#FFFFFF", border: "none", borderRadius: 6, padding: "7px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", textDecoration: "none", display: "inline-block" };
const dangerButtonStyle: CSSProperties = { background: "transparent", color: "#DC2626", border: "1px solid #FECACA", borderRadius: 6, padding: "7px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" };
const codeStyle: CSSProperties = { background: "#FAFAF8", border: "1px solid #E8E8E8", borderRadius: 6, padding: "5px 8px", color: "#2563EB", fontSize: 11, fontFamily: "monospace" };
const pillStyle: CSSProperties = { padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600 };
