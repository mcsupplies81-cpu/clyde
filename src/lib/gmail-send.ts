function sanitizeHeader(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

export function buildRFC2822Message(params: {
  to: string;
  from: string;
  subject: string;
  body: string;
  inReplyTo?: string | null;
  references?: string[];
}) {
  const headers = [
    `To: ${sanitizeHeader(params.to)}`,
    `From: ${sanitizeHeader(params.from)}`,
    `Subject: ${sanitizeHeader(params.subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
  ];

  if (params.inReplyTo) headers.push(`In-Reply-To: <${sanitizeHeader(params.inReplyTo)}>`);
  const refs = (params.references ?? []).filter(Boolean).map((id) => `<${sanitizeHeader(id)}>`).join(" ");
  if (refs) headers.push(`References: ${refs}`);

  const message = `${headers.join("\r\n")}\r\n\r\n${params.body}`;
  return Buffer.from(message, "utf8").toString("base64url");
}
