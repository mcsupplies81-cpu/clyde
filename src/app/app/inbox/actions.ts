"use server";

import { and, desc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { emailMessages, emailThreads, inboxConnections, inboxes } from "@/db/schema";
import { getGmailClient } from "@/lib/gmail";
import { decodeBody, normalizeThread, parseHeaders } from "@/lib/gmail-sync";

export async function syncGmailAction() {
  const tenantId = process.env.DEMO_TENANT_ID ?? "";
  const errors: string[] = [];
  let newThreads = 0;
  let newMessages = 0;

  if (!tenantId) return { newThreads, newMessages, errors: ["Missing DEMO_TENANT_ID."] };

  const inbox = await db.query.inboxes.findFirst({ where: eq(inboxes.tenantId, tenantId) });
  if (!inbox) return { newThreads, newMessages, errors: ["No inbox configured."] };

  const connection = await db.query.inboxConnections.findFirst({ where: and(eq(inboxConnections.tenantId, tenantId), eq(inboxConnections.inboxId, inbox.id)) });

  const gmail = getGmailClient(tenantId);

  let list;
  try {
    list = await gmail.users.threads.list({ userId: "me", maxResults: 50, q: "is:unread OR newer_than:7d" });
  } catch (error) {
    const msg = String(error);
    if (msg.includes("401")) {
      try {
        await gmail.users.getProfile({ userId: "me" });
      } catch {
        if (connection) {
          await db.update(inboxConnections).set({ status: "disconnected" }).where(eq(inboxConnections.id, connection.id));
        }
        return { newThreads, newMessages, errors: ["Gmail auth expired. Reconnect inbox."] };
      }
    }
    return { newThreads, newMessages, errors: [`Gmail list failed: ${msg}`] };
  }

  const threadIds = (list.data.threads ?? []).map((t) => t.id).filter(Boolean) as string[];

  const existing = threadIds.length
    ? await db.query.emailThreads.findMany({ where: inArray(emailThreads.gmailThreadId, threadIds) })
    : [];
  const existingByGmailThreadId = new Map(existing.map((t) => [t.gmailThreadId, t]));

  for (const threadId of threadIds) {
    try {
      const full = await gmail.users.threads.get({ userId: "me", id: threadId, format: "full" });
      const normalized = normalizeThread(full.data);
      if (!normalized.gmailThreadId) continue;

      const knownThread = existingByGmailThreadId.get(normalized.gmailThreadId);
      const knownMessageIds = knownThread
        ? new Set((await db.query.emailMessages.findMany({ where: eq(emailMessages.threadId, knownThread.id) })).map((m) => m.gmailMessageId).filter(Boolean))
        : new Set<string>();

      let threadRowId = knownThread?.id;
      let threadLastAt = knownThread?.lastMessageAt ? new Date(knownThread.lastMessageAt) : null;

      if (!threadRowId) {
        const firstMessage = normalized.messages[0];
        const parsed = parseHeaders(firstMessage?.payload?.headers);
        const inserted = await db.insert(emailThreads).values({
          tenantId,
          inboxId: inbox.id,
          subject: parsed.subject,
          status: "open",
          priority: "normal",
          gmailThreadId: normalized.gmailThreadId,
          gmailHistoryId: normalized.gmailHistoryId,
          lastMessageAt: parsed.date,
        }).returning({ id: emailThreads.id });
        threadRowId = inserted[0].id;
        newThreads += 1;
      }

      for (const m of normalized.messages) {
        if (!m.id || knownMessageIds.has(m.id)) continue;
        const parsed = parseHeaders(m.payload?.headers);
        const direction = parsed.fromEmail === inbox.emailAddress.toLowerCase() ? "outbound" : "inbound";
        const body = decodeBody(m.payload);
        await db.insert(emailMessages).values({
          tenantId,
          threadId: threadRowId,
          direction,
          senderName: parsed.fromName,
          senderEmail: parsed.fromEmail || "unknown@example.com",
          recipientEmail: parsed.toEmail || inbox.emailAddress,
          subject: parsed.subject,
          gmailMessageId: m.id,
          body: body || "(Empty body)",
          receivedAt: parsed.date,
        });
        newMessages += 1;
        if (parsed.date && (!threadLastAt || parsed.date > threadLastAt)) threadLastAt = parsed.date;
      }

      await db.update(emailThreads).set({
        gmailHistoryId: normalized.gmailHistoryId,
        lastMessageAt: threadLastAt,
      }).where(eq(emailThreads.id, threadRowId));
    } catch (error) {
      errors.push(`Thread ${threadId} failed: ${String(error)}`);
    }
  }

  if (connection) {
    await db.update(inboxConnections).set({ status: "connected", lastSyncAt: new Date() }).where(eq(inboxConnections.id, connection.id));
  }

  revalidatePath("/app/inbox");
  return { newThreads, newMessages, errors };
}
