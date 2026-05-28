/**
 * Unified email transport — picks Gmail if the tenant has a live connection,
 * otherwise falls back to Postmark. Import this instead of calling
 * sendReply() or sendViaGmail() directly.
 */

import { sendReply } from "@/lib/email-sender";
import { sendViaGmail, hasGmailConnection } from "@/lib/gmail";
import { db } from "@/db";
import { inboxConnections, tenants } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export interface EmailParams {
  to: string;
  from: string;          // sender address (used by Postmark; Gmail ignores and uses OAuth account)
  fromName?: string;
  subject: string;
  body: string;
  inReplyToMessageId?: string | null;
}

export interface EmailResult {
  sent: boolean;
  messageId?: string;
  error?: string;
  mode: "gmail" | "postmark" | "dry-run";
}

/**
 * Send an email using the best available transport for this tenant.
 * Gmail is preferred when connected; Postmark is the fallback.
 */
export async function sendEmail(tenantId: string, params: EmailParams): Promise<EmailResult> {
  if (tenantId && await hasGmailConnection(tenantId)) {
    const result = await sendViaGmail(tenantId, params);
    return result as EmailResult;
  }
  const result = await sendReply(params);
  return result as EmailResult;
}

/**
 * Get a display name for the current user / actor.
 * Tries Gmail email → tenant name → fallback.
 */
export async function getActorName(tenantId: string): Promise<string> {
  if (!tenantId) return "Ops Team";

  // Prefer the connected Gmail address — it's the real person's identity
  const gmailConn = await db.query.inboxConnections.findFirst({
    where: and(eq(inboxConnections.tenantId, tenantId), eq(inboxConnections.provider, "gmail")),
    columns: { gmailEmail: true },
  });
  if (gmailConn?.gmailEmail && !gmailConn.gmailEmail.includes("harborfreight.demo")) {
    return gmailConn.gmailEmail;
  }

  // Fall back to tenant name
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
    columns: { name: true },
  });
  return tenant?.name ?? "Ops Team";
}
