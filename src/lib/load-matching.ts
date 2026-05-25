export type EmailMessage = {
  id: string;
  subject?: string | null;
  body?: string | null;
  fromName?: string | null;
  receivedAt?: string | Date | null;
};

export type Load = {
  id: string;
  load_number?: string | null;
  po_number?: string | null;
  customer_name?: string | null;
  carrier_name?: string | null;
  origin_city?: string | null;
  origin_state?: string | null;
  destination_city?: string | null;
  destination_state?: string | null;
  pickup_date?: string | Date | null;
  delivery_date?: string | Date | null;
};

export type MatchResult = {
  matchedLoad: Load | null;
  confidence: number;
  matchedBy:
    | 'load_number'
    | 'po_number'
    | 'customer_lane'
    | 'carrier_dates'
    | 'none';
  reasoning: string;
};

const normalize = (value?: string | null): string =>
  (value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

const stripNonAlnum = (value: string): string => value.replace(/[^a-z0-9]/gi, '');

const containsExactToken = (haystack: string, needle?: string | null): boolean => {
  if (!needle) return false;
  const token = needle.trim();
  if (!token) return false;

  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const directRegex = new RegExp(`\\b${escaped}\\b`, 'i');
  if (directRegex.test(haystack)) return true;

  const normalizedHaystack = stripNonAlnum(haystack);
  const normalizedNeedle = stripNonAlnum(token);
  return normalizedNeedle.length > 0 && normalizedHaystack.includes(normalizedNeedle);
};

const dateHint = (value?: string | Date | null): string | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.valueOf())) return null;
  return date.toISOString().slice(0, 10);
};

export function matchEmailToLoad(emailMessage: EmailMessage, loads: Load[]): MatchResult {
  const subject = normalize(emailMessage.subject);
  const body = normalize(emailMessage.body);
  const content = `${subject}\n${body}`;

  for (const load of loads) {
    if (containsExactToken(content, load.load_number)) {
      return {
        matchedLoad: load,
        confidence: 0.98,
        matchedBy: 'load_number',
        reasoning: `Matched by exact load number (${load.load_number}).`,
      };
    }
  }

  for (const load of loads) {
    if (containsExactToken(content, load.po_number)) {
      return {
        matchedLoad: load,
        confidence: 0.94,
        matchedBy: 'po_number',
        reasoning: `Matched by exact PO number (${load.po_number}).`,
      };
    }
  }

  for (const load of loads) {
    const customerName = normalize(load.customer_name);
    const origin = normalize([load.origin_city, load.origin_state].filter(Boolean).join(' '));
    const destination = normalize([load.destination_city, load.destination_state].filter(Boolean).join(' '));

    const hasCustomer = !!customerName && content.includes(customerName);
    const hasLane = !!origin && !!destination && content.includes(origin) && content.includes(destination);

    if (hasCustomer && hasLane) {
      return {
        matchedLoad: load,
        confidence: 0.83,
        matchedBy: 'customer_lane',
        reasoning: `Matched by customer (${load.customer_name}) and lane (${origin} -> ${destination}).`,
      };
    }
  }

  for (const load of loads) {
    const carrierName = normalize(load.carrier_name);
    const pickup = dateHint(load.pickup_date);
    const delivery = dateHint(load.delivery_date);

    const hasCarrier = !!carrierName && content.includes(carrierName);
    const hasDateHint = [pickup, delivery].some((date) => !!date && content.includes(date));

    if (hasCarrier && hasDateHint) {
      return {
        matchedLoad: load,
        confidence: 0.71,
        matchedBy: 'carrier_dates',
        reasoning: `Matched by carrier (${load.carrier_name}) with pickup/delivery date hint.`,
      };
    }
  }

  return {
    matchedLoad: null,
    confidence: 0,
    matchedBy: 'none',
    reasoning: 'No deterministic match found using configured priority rules.',
  };
}
