export type EmailInput = {
  id: string;
  subject?: string | null;
  body?: string | null;
  senderName?: string | null;
};

export type LoadInput = {
  id: string;
  loadNumber?: string | null;
  poNumber?: string | null;
  customerName?: string | null;
  carrierName?: string | null;
  originCity?: string | null;
  originState?: string | null;
  destinationCity?: string | null;
  destinationState?: string | null;
  pickupAt?: Date | string | null;
  deliveryAt?: Date | string | null;
};

export type MatchResult = {
  matchedLoad: LoadInput | null;
  confidence: number;
  matchedBy: "load_number" | "po_number" | "customer_lane" | "carrier_dates" | "none";
  reasoning: string;
};

const norm = (v?: string | null) => (v ?? "").toLowerCase().replace(/\s+/g, " ").trim();
const stripNonAlnum = (v: string) => v.replace(/[^a-z0-9]/gi, "");

function containsToken(haystack: string, needle?: string | null): boolean {
  if (!needle?.trim()) return false;
  const escaped = needle.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(`\\b${escaped}\\b`, "i").test(haystack)) return true;
  const nh = stripNonAlnum(haystack);
  const nn = stripNonAlnum(needle);
  return nn.length > 0 && nh.includes(nn);
}

function dateStr(v?: Date | string | null): string | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.valueOf()) ? null : d.toISOString().slice(0, 10);
}

export function matchEmailToLoad(email: EmailInput, loads: LoadInput[]): MatchResult {
  const content = norm(`${email.subject ?? ""}\n${email.body ?? ""}`);

  for (const load of loads) {
    if (containsToken(content, load.loadNumber)) {
      return { matchedLoad: load, confidence: 0.98, matchedBy: "load_number", reasoning: `Exact load number match (${load.loadNumber}).` };
    }
  }

  for (const load of loads) {
    if (containsToken(content, load.poNumber)) {
      return { matchedLoad: load, confidence: 0.94, matchedBy: "po_number", reasoning: `Exact PO number match (${load.poNumber}).` };
    }
  }

  for (const load of loads) {
    const customer = norm(load.customerName);
    const origin = norm([load.originCity, load.originState].filter(Boolean).join(" "));
    const dest = norm([load.destinationCity, load.destinationState].filter(Boolean).join(" "));
    if (customer && content.includes(customer) && origin && dest && content.includes(origin) && content.includes(dest)) {
      return { matchedLoad: load, confidence: 0.83, matchedBy: "customer_lane", reasoning: `Customer + lane match (${load.customerName}, ${origin} → ${dest}).` };
    }
  }

  for (const load of loads) {
    const carrier = norm(load.carrierName);
    const hasCarrier = !!carrier && content.includes(carrier);
    const hasDate = [dateStr(load.pickupAt), dateStr(load.deliveryAt)].some((d) => !!d && content.includes(d));
    if (hasCarrier && hasDate) {
      return { matchedLoad: load, confidence: 0.71, matchedBy: "carrier_dates", reasoning: `Carrier + date hint match (${load.carrierName}).` };
    }
  }

  return { matchedLoad: null, confidence: 0, matchedBy: "none", reasoning: "No deterministic match found." };
}
