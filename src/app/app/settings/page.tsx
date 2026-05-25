import type { CSSProperties } from "react";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { inboxConnections, inboxes, tenants } from "@/db/schema";
import { and, asc, desc, eq } from "drizzle-orm";
import { AiSettingsClient } from "./AiSettingsClient";
import { AutopilotClient } from "./AutopilotClient";

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

export default async function SettingsPage() {
  const tenantId  = process.env.DEMO_TENANT_ID ?? "";
  const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY);

  const tenant    = tenantId ? await db.query.tenants.findFirst({ where: eq(tenants.id, tenantId) }) : null;
  const demoInbox = tenantId
    ? await db.query.inboxes.findFirst({ where: and(eq(inboxes.tenantId, tenantId)), orderBy: [asc(inboxes.createdAt)] })
    : null;
  const gmailConnection = tenantId
    ? await db.query.inboxConnections.findFirst({
        where: and(eq(inboxConnections.tenantId, tenantId), eq(inboxConnections.provider, "gmail")),
        orderBy: [desc(inboxConnections.createdAt)],
      })
    : null;

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
