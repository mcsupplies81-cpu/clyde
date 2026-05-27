/**
 * Classifies freight document attachments by filename and MIME type.
 * No AI needed — freight docs have predictable naming conventions.
 */

export type DocumentType =
  | "POD"
  | "BOL"
  | "Rate Confirmation"
  | "Lumper Receipt"
  | "Invoice"
  | "Carrier Packet"
  | "Other";

interface AttachmentMeta {
  fileName: string;
  contentType?: string;
}

const RULES: Array<{ type: DocumentType; patterns: RegExp[] }> = [
  {
    type: "POD",
    patterns: [
      /\bpod\b/i,
      /proof.?of.?delivery/i,
      /delivery.?receipt/i,
      /signed.?del/i,
      /del.?conf/i,
    ],
  },
  {
    type: "BOL",
    patterns: [
      /\bbol\b/i,
      /bill.?of.?lading/i,
      /\bbl\b/i,
      /pickup.?receipt/i,
      /shipper.?receipt/i,
    ],
  },
  {
    type: "Rate Confirmation",
    patterns: [
      /rate.?con/i,
      /\brc\b/i,
      /rate.?conf/i,
      /load.?conf/i,
      /carrier.?conf/i,
      /dispatch.?conf/i,
    ],
  },
  {
    type: "Lumper Receipt",
    patterns: [
      /lumper/i,
      /unload.?receipt/i,
      /labor.?receipt/i,
    ],
  },
  {
    type: "Invoice",
    patterns: [
      /invoice/i,
      /\binv\b/i,
      /\binv[-_]\d/i,
      /billing/i,
      /statement/i,
    ],
  },
  {
    type: "Carrier Packet",
    patterns: [
      /carrier.?packet/i,
      /onboard/i,
      /w.?9\b/i,
      /insurance/i,
      /\bcoi\b/i,
      /certificate.?of.?insurance/i,
      /mc.?cert/i,
    ],
  },
];

export function classifyDocument({ fileName, contentType }: AttachmentMeta): DocumentType {
  const name = fileName.toLowerCase();

  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(name))) {
      return rule.type;
    }
  }

  // If it's a PDF or image and we couldn't classify it — still useful, just "Other"
  return "Other";
}

/** Emoji icon for each doc type — used in UI */
export const DOC_ICON: Record<DocumentType, string> = {
  "POD":               "✅",
  "BOL":               "📋",
  "Rate Confirmation": "📄",
  "Lumper Receipt":    "🧾",
  "Invoice":           "💰",
  "Carrier Packet":    "📁",
  "Other":             "📎",
};

/** Color scheme for each doc type */
export const DOC_COLOR: Record<DocumentType, { bg: string; text: string; border: string }> = {
  "POD":               { bg: "#F0FDF4", text: "#15803D", border: "#BBF7D0" },
  "BOL":               { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE" },
  "Rate Confirmation": { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A" },
  "Lumper Receipt":    { bg: "#FDF4FF", text: "#7E22CE", border: "#E9D5FF" },
  "Invoice":           { bg: "#FFF7ED", text: "#C2410C", border: "#FED7AA" },
  "Carrier Packet":    { bg: "#F0FDF4", text: "#166534", border: "#BBF7D0" },
  "Other":             { bg: "#F9FAFB", text: "#6B7280", border: "#E5E7EB" },
};
