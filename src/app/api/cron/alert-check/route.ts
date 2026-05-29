import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/db";
import { emailThreads, emailMessages, aiClassifications, tenants } from "@/db/schema";
import { sendEmail } from "@/lib/send-email";

// Runs every 2 hours via Vercel cron.
// Finds urgent/escalation threads classified in the last 2.5 hours
// and sends an alert email to tenants that have alerts enabled.
export async function GET(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Look back 2.5 hours (a bit more than the cron interval to avoid missing any)
  const windowMs = 2.5 * 60 * 60 * 1000;
  const since = new Date(Date.now() - windowMs);

  // Find all tenants with alerts enabled
  const alertTenants = await db.select({
    id: tenants.id,
    name: tenants.name,
    alertsEmail: tenants.alertsEmail,
    contactEmail: tenants.contactEmail,
  }).from(tenants).where(eq(tenants.alertsEnabled, true));

  if (alertTenants.length === 0) {
    return NextResponse.json({ skipped: true, reason: "No tenants with alerts enabled" });
  }

  const results: Array<Record<string, unknown>> = [];

  for (const tenant of alertTenants) {
    const toEmail = tenant.alertsEmail ?? tenant.contactEmail;
    if (!toEmail) {
      results.push({ tenantId: tenant.id, skipped: true, reason: "No alert email configured" });
      continue;
    }

    // Find new urgent/escalation classifications in this window for this tenant
    const urgentCls = await db
      .select({
        messageId: aiClassifications.messageId,
        category: aiClassifications.category,
        urgency: aiClassifications.urgency,
        createdAt: aiClassifications.createdAt,
      })
      .from(aiClassifications)
      .where(
        and(
          eq(aiClassifications.tenantId, tenant.id),
          gte(aiClassifications.createdAt, since),
          inArray(aiClassifications.category, ["escalation", "detention_accessorial", "carrier_concern"]),
        ),
      )
      .limit(10);

    // Also grab high-urgency non-escalation threads
    const highUrgencyCls = await db
      .select({
        messageId: aiClassifications.messageId,
        category: aiClassifications.category,
        urgency: aiClassifications.urgency,
        createdAt: aiClassifications.createdAt,
      })
      .from(aiClassifications)
      .where(
        and(
          eq(aiClassifications.tenantId, tenant.id),
          gte(aiClassifications.createdAt, since),
          eq(aiClassifications.urgency, "high"),
        ),
      )
      .limit(10);

    // Combine + deduplicate by messageId
    const seen = new Set<string>();
    const allAlerts = [...urgentCls, ...highUrgencyCls].filter((c) => {
      if (seen.has(c.messageId)) return false;
      seen.add(c.messageId);
      return true;
    });

    if (allAlerts.length === 0) {
      results.push({ tenantId: tenant.id, skipped: true, reason: "No urgent threads in window" });
      continue;
    }

    // Fetch the thread subjects for context
    const msgIds = allAlerts.map((c) => c.messageId);
    const messages = await db
      .select({ id: emailMessages.id, subject: emailMessages.subject, senderName: emailMessages.senderName, senderEmail: emailMessages.senderEmail, threadId: emailMessages.threadId })
      .from(emailMessages)
      .where(inArray(emailMessages.id, msgIds));

    const msgById = new Map(messages.map((m) => [m.id, m]));

    // Build the alert email body
    const alertItems = allAlerts.map((cls) => {
      const msg = msgById.get(cls.messageId);
      const sender = msg?.senderName ?? msg?.senderEmail ?? "Unknown";
      const subject = msg?.subject ?? "(no subject)";
      const catLabel = cls.category.replace(/_/g, " ");
      return `• [${catLabel.toUpperCase()}] "${subject}" — from ${sender}`;
    }).join("\n");

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.clydefreight.com";
    const body = `Hi ${tenant.name} team,

You have ${allAlerts.length} urgent item${allAlerts.length > 1 ? "s" : ""} in your Clyde inbox that ${allAlerts.length > 1 ? "need" : "needs"} attention:

${alertItems}

Review them now → ${appUrl}/app/inbox

---
This alert was sent because you have email notifications enabled in Clyde.
To turn off alerts, go to Settings → Notifications.`;

    const result = await sendEmail(tenant.id, {
      to: toEmail,
      from: "alerts@clydefreight.com",
      fromName: "Clyde Alerts",
      subject: `⚠ ${allAlerts.length} urgent thread${allAlerts.length > 1 ? "s" : ""} in your Clyde inbox`,
      body,
    });

    results.push({ tenantId: tenant.id, alertCount: allAlerts.length, sent: result.sent, mode: result.mode });
  }

  return NextResponse.json({ checkedAt: new Date().toISOString(), tenantsChecked: alertTenants.length, results });
}
