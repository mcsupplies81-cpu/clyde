import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { emailMessages, emailThreads, inboxes, aiClassifications, aiDrafts, auditLogs, sopRules, loads, loadDocuments, emailAttachments } from "@/db/schema";
import { and, desc, eq, ilike } from "drizzle-orm";
import { mockClassify, openAiClassify } from "@/lib/ai-classifier";
import { canAutoSend, SAFE_TO_AUTO_DRAFT } from "@/lib/safety";
import { classifyDocument } from "@/lib/document-classifier";

type PostmarkAttachment = {
  Name: string;
  Content: string;        // base64
  ContentType: string;
  ContentLength: number;
  ContentID?: string;
};

type PostmarkInbound = {
  From: string;
  FromName?: string;
  To: string;
  Subject?: string;
  TextBody?: string;
  HtmlBody?: string;
  MessageID?: string;
  Date?: string;
  Headers?: Array<{ Name: string; Value: string }>;
  Attachments?: PostmarkAttachment[];
};

function cleanSubject(subject: string) {
  return subject.replace(/^(re|fwd?|fw):\s*/gi, "").trim();
}

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 10000);
}

function parseEmail(raw: string) {
  return raw.replace(/.*<(.+)>/, "$1").toLowerCase().trim();
}

export async function POST(req: NextRequest) {
  const secret = process.env.INBOUND_WEBHOOK_SECRET;
  if (secret) {
    const token = req.headers.get("x-webhook-secret") ?? req.nextUrl.searchParams.get("secret");
    if (token !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let payload: PostmarkInbound;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { From, FromName, To, Subject, TextBody, HtmlBody, MessageID, Date: msgDate, Headers, Attachments } = payload;
  if (!From || !To) return NextResponse.json({ error: "Missing From/To" }, { status: 400 });

  // Match inbox by the To address
  const toEmail = parseEmail(To);
  const inbox = await db.query.inboxes.findFirst({
    where: ilike(inboxes.emailAddress, toEmail),
  });

  if (!inbox) {
    console.warn("[inbound-email] No inbox for:", toEmail);
    return NextResponse.json({ ok: true, skipped: "no_inbox" });
  }

  const tenantId = inbox.tenantId;
  const fromEmail = parseEmail(From);
  const fromName = (FromName?.trim() || From.split("@")[0]).slice(0, 120);
  const body = (TextBody || (HtmlBody ? stripHtml(HtmlBody) : "")).trim();
  const subject = (Subject || "(no subject)").trim();
  const cleanedSubject = cleanSubject(subject);
  const receivedAt = msgDate ? new Date(msgDate) : new Date();

  // Deduplicate by gmailMessageId (repurposed as generic external ID)
  if (MessageID) {
    const dup = await db.query.emailMessages.findFirst({
      where: eq(emailMessages.gmailMessageId, MessageID),
    });
    if (dup) return NextResponse.json({ ok: true, skipped: "duplicate" });
  }

  // ── Thread matching ────────────────────────────────────────────────────────
  // 1. In-Reply-To header — most reliable (reply to a Clyde-sent email)
  const inReplyTo = Headers?.find((h) => h.Name === "In-Reply-To")?.Value?.trim();
  let thread = null;

  if (inReplyTo) {
    const parentMsg = await db.query.emailMessages.findFirst({
      where: eq(emailMessages.gmailMessageId, inReplyTo),
      columns: { threadId: true },
    });
    if (parentMsg) {
      thread = await db.query.emailThreads.findFirst({
        where: eq(emailThreads.id, parentMsg.threadId),
      });
      if (thread) console.log("[inbound-email] Linked reply via In-Reply-To to thread", thread.id);
    }
  }

  // 2. Subject + sender match (fallback for forwarded email or first contact)
  if (!thread) {
    thread = await db.query.emailThreads.findFirst({
      where: and(
        eq(emailThreads.tenantId, tenantId),
        eq(emailThreads.inboxId, inbox.id),
        ilike(emailThreads.subject, cleanedSubject),
        eq(emailThreads.customerName, fromName),
      ),
      orderBy: [desc(emailThreads.lastMessageAt)],
    });
  }

  if (!thread) {
    const [inserted] = await db.insert(emailThreads).values({
      tenantId,
      inboxId: inbox.id,
      subject: cleanedSubject,
      status: "open",
      priority: "normal",
      customerName: fromName,
      lastMessageAt: receivedAt,
    }).returning();
    thread = inserted;
  } else {
    await db.update(emailThreads)
      .set({ lastMessageAt: receivedAt, status: thread.status === "resolved" ? "open" : thread.status })
      .where(eq(emailThreads.id, thread.id));
  }

  if (!thread) return NextResponse.json({ error: "Thread creation failed" }, { status: 500 });

  // Create the message
  const [message] = await db.insert(emailMessages).values({
    tenantId,
    threadId: thread.id,
    direction: "inbound",
    senderName: fromName,
    senderEmail: fromEmail,
    recipientEmail: toEmail,
    subject,
    body,
    gmailMessageId: MessageID ?? null,
    receivedAt,
  }).returning();

  if (!message) return NextResponse.json({ error: "Message creation failed" }, { status: 500 });

  // Classify
  const clsInput = { messageId: message.id, subject, body, senderName: fromName, senderEmail: fromEmail };
  const clsResult = process.env.OPENAI_API_KEY ? await openAiClassify(clsInput) : mockClassify(clsInput);

  await db.insert(aiClassifications).values({
    tenantId,
    messageId: message.id,
    category: clsResult.category,
    urgency: clsResult.urgency,
    confidence: String(clsResult.confidence),
    extractedLoadNumber: clsResult.extractedLoadNumber,
    extractedCustomer: clsResult.extractedCustomer,
    extractedCarrier: clsResult.extractedCarrier,
    suggestedAction: clsResult.suggestedAction,
    reasoning: clsResult.reasoning,
  });

  // Update thread priority from classification
  const newPriority =
    clsResult.urgency === "high" ? "high" :
    clsResult.urgency === "low" ? "low" : "normal";

  await db.update(emailThreads)
    .set({ priority: newPriority })
    .where(eq(emailThreads.id, thread.id));

  await db.insert(auditLogs).values({
    tenantId, actorType: "system", actorName: "Inbound Webhook",
    entityType: "email_thread", entityId: thread.id,
    action: "email_received",
    metadata: { from: fromEmail, subject, category: clsResult.category },
  });

  // Auto-draft for safe categories
  if (SAFE_TO_AUTO_DRAFT.has(clsResult.category)) {
    const matchedLoad = clsResult.extractedLoadNumber
      ? await db.query.loads.findFirst({
          where: and(eq(loads.loadNumber, clsResult.extractedLoadNumber), eq(loads.tenantId, tenantId)),
        })
      : null;

    const sops = await db.select().from(sopRules).where(
      and(eq(sopRules.tenantId, tenantId), eq(sopRules.isActive, true), eq(sopRules.category, clsResult.category)),
    );
    const sopRequiresApproval = sops.some((s) => s.requireApproval);

    let draftBody = "";
    if (process.env.OPENAI_API_KEY) {
      try {
        const OpenAI = (await import("openai")).default;
        const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 15000 });
        const fmt = (d: Date | null | undefined) =>
          d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;
        const loadLines = matchedLoad ? [
          `Load #${matchedLoad.loadNumber}`,
          `Route: ${matchedLoad.originCity}, ${matchedLoad.originState} → ${matchedLoad.destinationCity}, ${matchedLoad.destinationState}`,
          `Status: ${matchedLoad.currentStatus ?? "Unknown"}`,
          matchedLoad.carrierName ? `Carrier: ${matchedLoad.carrierName}` : null,
          matchedLoad.driverName ? `Driver: ${matchedLoad.driverName}` : null,
          matchedLoad.pickupAt ? `Pickup: ${fmt(matchedLoad.pickupAt)}` : null,
          matchedLoad.deliveryAt ? `Delivery: ${fmt(matchedLoad.deliveryAt)}` : null,
          matchedLoad.eta ? `ETA: ${fmt(matchedLoad.eta)}` : null,
        ].filter(Boolean).join("\n") : null;

        const context = [
          `Email subject: ${subject}`,
          `Email body:\n${body}`,
          loadLines ? `\nLoad details:\n${loadLines}` : "",
          sops.length ? `\nSOPs:\n${sops.map((s) => `- ${s.ruleText}`).join("\n")}` : "",
        ].filter(Boolean).join("\n");

        const completion = await client.chat.completions.create({
          model: "gpt-4o-mini",
          max_tokens: 300,
          messages: [
            {
              role: "system",
              content: "You are Clyde, a freight ops AI for a freight brokerage. Draft a concise professional email reply under 150 words. Never invent load details not provided. Always include the load number if available. Sign off as 'Clyde\nFreight Ops AI'. Body text only, no subject line.",
            },
            { role: "user", content: context },
          ],
        });
        draftBody = completion.choices[0]?.message?.content ?? "";
      } catch (err) {
        console.error("[inbound-email] draft error:", err);
      }
    }

    if (!draftBody) {
      const ref = matchedLoad?.loadNumber ? `load #${matchedLoad.loadNumber}` : "your shipment";
      draftBody = `Thank you for reaching out regarding ${ref}. Our team is reviewing this and will follow up shortly.\n\nClyde\nFreight Ops AI`;
    }

    const isFullAuto = !sopRequiresApproval && canAutoSend(clsResult.category, matchedLoad ? 0.85 : 0, false);

    await db.insert(aiDrafts).values({
      tenantId,
      messageId: message.id,
      loadId: matchedLoad?.id ?? null,
      draftSubject: `Re: ${subject}`,
      draftBody,
      confidence: "0.85",
      approvalRequired: !isFullAuto,
      status: isFullAuto ? "approved" : "pending",
    });

    await db.update(emailThreads)
      .set({ status: isFullAuto ? "sent" : "pending_review" })
      .where(eq(emailThreads.id, thread.id));

    await db.insert(auditLogs).values({
      tenantId, actorType: "ai", actorName: "Clyde AI",
      entityType: "email_thread", entityId: thread.id,
      action: isFullAuto ? "autopilot_auto_sent" : "draft_generated",
      metadata: { category: clsResult.category, isFullAuto },
    });
  }

  // ── Process attachments ───────────────────────────────────────────────────────
  const attachmentList = Attachments ?? [];
  const realAttachments = attachmentList.filter(
    (a) => !a.ContentID && a.ContentLength > 0,  // skip inline images (ContentID = embedded)
  );

  if (realAttachments.length > 0) {
    // Re-fetch the matched load in case we need it for loadDocuments
    const matchedLoad = clsResult.extractedLoadNumber
      ? await db.query.loads.findFirst({
          where: and(eq(loads.loadNumber, clsResult.extractedLoadNumber), eq(loads.tenantId, tenantId)),
          columns: { id: true, loadNumber: true },
        })
      : null;

    for (const att of realAttachments) {
      const docType = classifyDocument({ fileName: att.Name, contentType: att.ContentType });

      // Upload to Vercel Blob if configured, otherwise skip file storage
      let fileUrl: string | null = null;
      const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
      if (blobToken) {
        try {
          const { put } = await import("@vercel/blob");
          const blobPath = `attachments/${tenantId}/${thread.id}/${att.Name}`;
          const buffer = Buffer.from(att.Content, "base64");
          const blob = await put(blobPath, buffer, {
            access: "public",
            contentType: att.ContentType,
            token: blobToken,
          });
          fileUrl = blob.url;
        } catch (err) {
          console.error("[inbound-email] Blob upload failed:", err);
        }
      }

      // Record in email_attachments (always, even without fileUrl)
      let loadDocId: string | null = null;
      if (matchedLoad) {
        // Also link to loadDocuments so the load detail page shows it
        const [ldoc] = await db.insert(loadDocuments).values({
          tenantId,
          loadId: matchedLoad.id,
          documentType: docType,
          fileName: att.Name,
          fileUrl: fileUrl ?? "",
        }).returning({ id: loadDocuments.id });
        loadDocId = ldoc?.id ?? null;
      }

      await db.insert(emailAttachments).values({
        tenantId,
        messageId: message.id,
        loadDocumentId: loadDocId,
        documentType: docType,
        fileName: att.Name,
        fileUrl,
        contentType: att.ContentType,
        fileSizeBytes: att.ContentLength,
      });
    }

    // Log it
    await db.insert(auditLogs).values({
      tenantId, actorType: "system", actorName: "Inbound Webhook",
      entityType: "email_message", entityId: message.id,
      action: "attachments_received",
      metadata: {
        count: realAttachments.length,
        files: realAttachments.map((a) => ({
          name: a.Name,
          type: classifyDocument({ fileName: a.Name, contentType: a.ContentType }),
        })),
      },
    });

    console.log(`[inbound-email] Processed ${realAttachments.length} attachment(s) on message ${message.id}`);
  }

  return NextResponse.json({ ok: true, threadId: thread.id, messageId: message.id, category: clsResult.category });
}
