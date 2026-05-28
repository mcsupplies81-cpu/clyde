/**
 * Postmark email sender.
 * Set POSTMARK_API_TOKEN in env to enable real sending.
 * Without it, sending is logged but not transmitted (safe for dev).
 */

interface SendReplyParams {
  to: string;          // recipient email
  from: string;        // inbox email address (sender)
  fromName?: string;   // display name, e.g. "Clyde | Harbor Freight"
  subject: string;
  body: string;
  inReplyToMessageId?: string | null; // for email threading (In-Reply-To header)
}

interface SendResult {
  sent: boolean;
  messageId?: string;
  error?: string;
  mode: "postmark" | "dry-run";
}

export async function sendReply(params: SendReplyParams): Promise<SendResult> {
  const token = process.env.POSTMARK_API_TOKEN;
  // Allow overriding the FROM address via env (needed when inbox.emailAddress is
  // the Postmark inbound address, not a verified sender signature)
  const fromEmail = process.env.POSTMARK_FROM_EMAIL ?? params.from;

  if (!token) {
    // No token — log and return dry-run success so the app still works
    console.log("[email-sender] DRY RUN (no POSTMARK_API_TOKEN):", {
      to: params.to,
      from: params.from,
      subject: params.subject,
      bodyLength: params.body.length,
    });
    return { sent: true, mode: "dry-run" };
  }

  const headers: Array<{ Name: string; Value: string }> = [];
  if (params.inReplyToMessageId) {
    headers.push({ Name: "In-Reply-To", Value: params.inReplyToMessageId });
    headers.push({ Name: "References", Value: params.inReplyToMessageId });
  }

  const payload = {
    From: params.fromName ? `${params.fromName} <${fromEmail}>` : fromEmail,
    To: params.to,
    Subject: params.subject,
    TextBody: params.body,
    MessageStream: "outbound",
    ...(headers.length > 0 && { Headers: headers }),
  };

  try {
    const res = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": token,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json() as { MessageID?: string; ErrorCode?: number; Message?: string };

    if (!res.ok) {
      console.error("[email-sender] Postmark error:", data);
      return { sent: false, error: data.Message ?? "Unknown Postmark error", mode: "postmark" };
    }

    return { sent: true, messageId: data.MessageID, mode: "postmark" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error";
    console.error("[email-sender] fetch error:", msg);
    return { sent: false, error: msg, mode: "postmark" };
  }
}
