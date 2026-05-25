import type { gmail_v1 } from "googleapis";

export type ParsedHeaders = {
  fromName: string | null;
  fromEmail: string;
  toEmail: string;
  subject: string;
  date: Date | null;
};

function getHeader(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string) {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function decodeBase64Url(input: string) {
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function stripHtml(html: string) {
  return html.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function findPart(parts: gmail_v1.Schema$MessagePart[] | undefined, mimeType: string): gmail_v1.Schema$MessagePart | undefined {
  if (!parts?.length) return undefined;
  for (const part of parts) {
    if (part.mimeType === mimeType) return part;
    const nested = findPart(part.parts, mimeType);
    if (nested) return nested;
  }
  return undefined;
}

export function decodeBody(payload: gmail_v1.Schema$MessagePart | undefined) {
  if (!payload) return "";
  const plain = payload.mimeType === "text/plain" ? payload : findPart(payload.parts, "text/plain");
  if (plain?.body?.data) return decodeBase64Url(plain.body.data);

  const html = payload.mimeType === "text/html" ? payload : findPart(payload.parts, "text/html");
  if (html?.body?.data) return stripHtml(decodeBase64Url(html.body.data));

  if (payload.body?.data) return decodeBase64Url(payload.body.data);
  return "";
}

export function parseHeaders(headers: gmail_v1.Schema$MessagePartHeader[] | undefined): ParsedHeaders {
  const fromRaw = getHeader(headers, "From");
  const toRaw = getHeader(headers, "To");
  const subject = getHeader(headers, "Subject") || "(No subject)";
  const dateRaw = getHeader(headers, "Date");

  const fromMatch = fromRaw.match(/^(.*?)\s*<([^>]+)>$/);
  const toMatch = toRaw.match(/^(.*?)\s*<([^>]+)>$/);

  const fromEmail = (fromMatch?.[2] ?? fromRaw).trim().toLowerCase();
  const fromName = (fromMatch?.[1] ?? "").replace(/^"|"$/g, "").trim() || null;
  const toEmail = (toMatch?.[2] ?? toRaw).trim().toLowerCase();

  return {
    fromName,
    fromEmail,
    toEmail,
    subject,
    date: dateRaw ? new Date(dateRaw) : null,
  };
}

export function normalizeThread(thread: gmail_v1.Schema$Thread) {
  return {
    gmailThreadId: thread.id ?? "",
    gmailHistoryId: thread.historyId ?? null,
    messages: thread.messages ?? [],
  };
}
