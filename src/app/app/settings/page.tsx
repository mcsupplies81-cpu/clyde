import type { CSSProperties } from "react";
import { revalidatePath } from "next/cache";
import { createHash, randomBytes } from "crypto";
import { db } from "@/db";
import { inboxConnections, inboxes, tenants, apiKeys } from "@/db/schema";
import { and, asc, desc, eq } from "drizzle-orm";
import { getTenantIdForUser } from "@/lib/auth";
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
  const tenantId = (await getTenantIdForUser()) ?? "";
  const name = String(formData.get("name") ?? "").trim();
  if (!tenantId || !name) return;
  await db.update(tenants).set({ name }).where(eq(tenants.id, tenantId));
  revalidatePath("/app/settings");
}

async function updateInboxEmail(formData: FormData) {
  "use server";
  const tenantId = (await getTenantIdForUser()) ?? "";
  const inboxId  = String(formData.get("inboxId") ?? "").trim();
  const email    = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!tenantId || !inboxId || !email || !email.includes("@")) return;
  await db.update(inboxes)
    .set({ emailAddress: email })
    .where(and(eq(inboxes.id, inboxId), eq(inboxes.tenantId, tenantId)));
  revalidatePath("/app/settings");
}

async function createApiKeyAction(_prev: unknown, formData: FormData) {
  "use server";
  const tenantId = (await getTenantIdForUser()) ?? "";
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
  const tenantId = (await getTenantIdForUser()) ?? "";
  const keyId = String(formData.get("keyId") ?? "");
  if (!tenantId || !keyId) return { error: "Missing params" };

  await db.update(apiKeys)
    .set({ isActive: false })
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.tenantId, tenantId)));
  revalidatePath("/app/settings");
  return { ok: true };
}

export default async function SettingsPage() {
  const tenantId = (await getTenantIdForUser()) ?? "";
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

          {/* Inbound address — editable */}
          {demoInbox ? (
            <form action={updateInboxEmail} style={{ paddingTop: 4 }}>
              <input type="hidden" name="inboxId" value={demoInbox.id} />
              <div style={{ marginBottom: 6 }}>
                <div style={labelStyle}>Inbound email address</div>
                <div style={{ ...subtleStyle, marginBottom: 8 }}>
                  Paste your Postmark inbound address here — all emails sent to it arrive in Clyde.
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    name="email"
                    type="email"
                    required
                    defaultValue={demoInbox.emailAddress}
                    placeholder="you@inbound.postmarkapp.com"
                    style={{ ...inputStyle, flex: 1, fontFamily: "monospace", fontSize: 12 }}
                  />
                  <button type="submit" style={buttonStyle}>Save</button>
                </div>
              </div>
            </form>
          ) : (
            <div style={rowStyle}>
              <div style={labelStyle}>Inbound email address</div>
              <span style={{ fontSize: 12, color: "#9CA3AF" }}>No inbox found — contact support</span>
            </div>
          )}

          {/* Postmark setup steps */}
          <div style={{ borderTop: "1px solid #F2F2F2", paddingTop: 14, marginTop: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase" as const, letterSpacing: "0.5px", marginBottom: 10 }}>
              Postmark setup (5 min)
            </div>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
              {[
                { step: "1", detail: "Create a free account at postmark.com → add a Server → go to the Inbound tab" },
                { step: "2", detail: <>Set the webhook URL to: <code style={{ background: "#F2F2F2", padding: "1px 5px", borderRadius: 3, fontSize: 11 }}>{baseUrl}/api/webhooks/inbound-email</code></> },
                { step: "3", detail: "Copy the inbound email address Postmark gives you (e.g. abc123@inbound.postmarkapp.com) and paste it above" },
                { step: "4", detail: "Copy your Server API Token → add it to Vercel env vars as POSTMARK_API_TOKEN" },
                { step: "5", detail: "Send a test email to your inbound address — it should appear in Clyde within seconds" },
              ].map(({ step, detail }) => (
                <div key={step} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#EFF6FF", border: "1px solid #BFDBFE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#2563EB", flexShrink: 0, marginTop: 1 }}>{step}</div>
                  <div style={{ fontSize: 12, color: "#7F7F7F", lineHeight: 1.5, paddingTop: 2 }}>{detail}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Webhook info */}
          <details style={{ borderTop: "1px solid #F2F2F2", paddingTop: 10, marginTop: 10 }}>
            <summary style={{ cursor: "pointer", fontSize: 12, color: "#2563EB", fontWeight: 600, userSelect: "none" as const }}>
              Advanced: raw webhook endpoint ↓
            </summary>
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, color: "#7F7F7F", marginBottom: 6 }}>
                Postmark, Mailgun, SendGrid inbound parse — all send to the same endpoint:
              </div>
              <code style={{ ...codeStyle, fontSize: 11, display: "block", padding: "8px 12px" }}>
                POST {baseUrl}/api/webhooks/inbound-email
              </code>
              <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 6 }}>
                Optional: set header <code>x-webhook-secret</code> = <code>INBOUND_WEBHOOK_SECRET</code> env var to secure the endpoint.
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
          <h2 style={sectionTitleStyle}>Debug Info</h2>
          <div style={rowStyle}>
            <div style={labelStyle}>Tenant ID</div>
            <code style={codeStyle}>{tenantId || "not set"}</code>
          </div>
          <div style={rowStyle}>
            <div style={labelStyle}>Inbox email</div>
            <code style={codeStyle}>{demoInbox?.emailAddress ?? "none"}</code>
          </div>
          <div style={rowStyle}>
            <div style={labelStyle}>Postmark sending</div>
            <div style={{ ...pillStyle, background: process.env.POSTMARK_API_TOKEN ? "#F0FDF4" : "#FFF7ED", color: process.env.POSTMARK_API_TOKEN ? "#16A34A" : "#EA580C" }}>
              {process.env.POSTMARK_API_TOKEN ? "Connected" : "Not configured — emails dry-run only"}
            </div>
          </div>
          <div style={rowStyle}>
            <div style={labelStyle}>Blob storage</div>
            <div style={{ ...pillStyle, background: process.env.BLOB_READ_WRITE_TOKEN ? "#F0FDF4" : "#F9FAFB", color: process.env.BLOB_READ_WRITE_TOKEN ? "#16A34A" : "#9CA3AF" }}>
              {process.env.BLOB_READ_WRITE_TOKEN ? "Connected" : "Not configured — attachments metadata only"}
            </div>
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
