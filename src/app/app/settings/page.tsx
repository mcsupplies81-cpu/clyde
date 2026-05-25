import type { CSSProperties } from "react";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { inboxes, tenants } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { AiSettingsClient } from "./AiSettingsClient";

const timezones = ["UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Europe/London"];

async function updateTenantName(formData: FormData) {
  "use server";

  const tenantId = process.env.DEMO_TENANT_ID ?? "";
  const name = String(formData.get("name") ?? "").trim();

  if (!tenantId || !name) return;

  await db.update(tenants).set({ name }).where(eq(tenants.id, tenantId));
  revalidatePath("/app/settings");
}

export default async function SettingsPage() {
  const tenantId = process.env.DEMO_TENANT_ID ?? "";
  const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY);

  const tenant = tenantId ? await db.query.tenants.findFirst({ where: eq(tenants.id, tenantId) }) : null;
  const demoInbox = tenantId
    ? await db.query.inboxes.findFirst({ where: and(eq(inboxes.tenantId, tenantId)), orderBy: [asc(inboxes.createdAt)] })
    : null;

  return (
    <div style={{ padding: 24, color: "#9ca3af", background: "#030712", minHeight: "100%" }}>
      <h1 style={{ margin: "0 0 16px", fontSize: 20, color: "#f3f4f6" }}>Settings</h1>
      <div style={{ display: "grid", gap: 14 }}>
        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Company Profile</h2>
          <form action={updateTenantName} style={rowStyle}>
            <div>
              <div style={labelStyle}>Tenant name</div>
              <div style={subtleStyle}>From tenants table</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input name="name" defaultValue={tenant?.name ?? ""} style={inputStyle} />
              <button type="submit" style={buttonStyle}>Save</button>
            </div>
          </form>

          <div style={rowStyle}>
            <div>
              <div style={labelStyle}>Demo inbox email address</div>
              <div style={subtleStyle}>From inboxes table</div>
            </div>
            <code style={codeStyle}>{demoInbox?.emailAddress ?? "No inbox found"}</code>
          </div>

          <div style={rowStyle}>
            <div>
              <div style={labelStyle}>Timezone</div>
              <div style={subtleStyle}>Static selector (v1)</div>
            </div>
            <select style={inputStyle} defaultValue="UTC">
              {timezones.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
        </section>

        <section style={sectionStyle}>
          <AiSettingsClient />
          <div style={{ ...rowStyle, borderTop: "1px solid #1f2937", marginTop: 10 }}>
            <div>
              <div style={labelStyle}>Model</div>
            </div>
            <code style={codeStyle}>{hasOpenAiKey ? "gpt-4.1-mini" : "Mock classifier (keyword-based)"}</code>
          </div>
          <div style={rowStyle}>
            <div style={labelStyle}>OpenAI key status</div>
            <div style={{ ...pillStyle, background: hasOpenAiKey ? "#052e16" : "#3f2b07", color: hasOpenAiKey ? "#86efac" : "#fde68a" }}>
              {hasOpenAiKey ? "Connected" : "Not configured — using mock"}
            </div>
          </div>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Integration Status</h2>
          <div style={integrationGridStyle}>
            {[
              ["Gmail", "Not connected", "Coming soon"],
              ["Outlook", "Not connected", "Coming soon"],
              ["TMS", "Demo mode — mock data", ""],
              ["Tracking", "Demo mode — mock data", ""],
            ].map(([name, status, tooltip]) => (
              <div key={name} style={integrationCardStyle}>
                <div style={labelStyle}>{name}</div>
                <div style={subtleStyle}>{status}</div>
                {(name === "Gmail" || name === "Outlook") && (
                  <button disabled title={tooltip || undefined} style={disabledButtonStyle}>Connect</button>
                )}
              </div>
            ))}
          </div>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Demo Tools</h2>
          <div style={rowStyle}>
            <div style={labelStyle}>Re-seed demo data</div>
            <code style={codeStyle}>npm run db:seed</code>
          </div>
          <div style={rowStyle}>
            <div style={labelStyle}>Current tenant ID</div>
            <code style={codeStyle}>{tenantId || "DEMO_TENANT_ID not set"}</code>
          </div>
        </section>
      </div>
    </div>
  );
}

const sectionStyle: CSSProperties = { background: "#111827", border: "1px solid #1f2937", borderRadius: 10, padding: 20 };
const sectionTitleStyle: CSSProperties = { margin: "0 0 14px", fontSize: 14, color: "#e5e7eb", fontWeight: 600 };
const rowStyle: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: "10px 0", borderTop: "1px solid #1f2937" };
const labelStyle: CSSProperties = { fontSize: 13, color: "#f3f4f6", fontWeight: 500 };
const subtleStyle: CSSProperties = { marginTop: 3, fontSize: 12, color: "#6b7280" };
const inputStyle: CSSProperties = { background: "#0b1220", border: "1px solid #253042", borderRadius: 6, color: "#e5e7eb", padding: "7px 10px", fontSize: 12 };
const buttonStyle: CSSProperties = { background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 6, padding: "7px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" };
const codeStyle: CSSProperties = { background: "#0b1220", border: "1px solid #1f2937", borderRadius: 6, padding: "5px 8px", color: "#93c5fd", fontSize: 12 };
const pillStyle: CSSProperties = { padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600 };
const integrationGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 };
const integrationCardStyle: CSSProperties = { background: "#0b1220", border: "1px solid #1f2937", borderRadius: 8, padding: 12, minHeight: 86, display: "flex", flexDirection: "column", gap: 8 };
const disabledButtonStyle: CSSProperties = { marginTop: "auto", background: "#1f2937", color: "#94a3b8", border: "1px solid #334155", borderRadius: 6, padding: "6px 10px", fontSize: 12, cursor: "not-allowed" };
