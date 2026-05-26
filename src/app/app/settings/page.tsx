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
          <h2 style={sectionTitleStyle}>Gmail Integration</h2>
          <div style={rowStyle}>
            <div>
              <div style={labelStyle}>Connection status</div>
              <div style={subtleStyle}>
                {gmailConnection ? `Connected: ${gmailConnection.gmailEmail}` : "Not connected"}
              </div>
            </div>
            {gmailConnection ? (
              <form action={disconnectGmail}>
                <input type="hidden" name="tenantId" value={tenantId} />
                <button type="submit" style={dangerButtonStyle}>Disconnect</button>
              </form>
            ) : (
              <a href="/api/auth/gmail" style={buttonStyle}>Connect Gmail</a>
            )}
          </div>
          <div style={rowStyle}>
            <div style={labelStyle}>Last sync</div>
            <code style={codeStyle}>
              {gmailConnection?.lastSyncAt ? new Date(gmailConnection.lastSyncAt).toLocaleString() : "Never"}
            </code>
          </div>
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
