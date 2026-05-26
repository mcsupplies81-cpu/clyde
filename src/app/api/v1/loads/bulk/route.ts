/**
 * POST /api/v1/loads/bulk
 *
 * Push multiple loads in a single request. Same payload schema as
 * POST /api/v1/loads but wrapped in { loads: [...] }.
 * Safe to call on every TMS sync — upserts on loadNumber.
 *
 * Returns per-load results so callers know exactly what succeeded or failed.
 */

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { db } from "@/db";
import { apiKeys, loads } from "@/db/schema";
import { and, eq } from "drizzle-orm";

async function authenticate(req: NextRequest): Promise<{ tenantId: string } | null> {
  const auth = req.headers.get("authorization") ?? "";
  const raw  = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!raw) return null;
  const hash = createHash("sha256").update(raw).digest("hex");
  const key  = await db.query.apiKeys.findFirst({ where: and(eq(apiKeys.keyHash, hash), eq(apiKeys.isActive, true)) });
  if (!key) return null;
  db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, key.id)).catch(() => {});
  return { tenantId: key.tenantId };
}

type LoadPayload = Record<string, unknown>;

function parseDate(val: unknown): Date | null {
  if (!val || typeof val !== "string") return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function normalize(body: LoadPayload): { loadNumber: string; data: Record<string, unknown> } | { error: string } {
  const loadNumber = String(body.loadNumber ?? body.load_number ?? "").toUpperCase().trim();
  if (!loadNumber) return { error: "loadNumber is required" };

  const STATUS_MAP: Record<string, string> = {
    booked: "open", planned: "open", open: "open",
    picked_up: "in_transit", pickup: "in_transit", in_transit: "in_transit",
    out_for_delivery: "in_transit",
    delivered: "delivered", pod_received: "delivered", complete: "delivered", completed: "delivered",
    exception: "exception", problem: "exception",
    cancelled: "cancelled", canceled: "cancelled",
  };
  const RISK_MAP: Record<string, string> = { low: "low", normal: "normal", high: "high", critical: "critical" };

  const rawStatus = String(body.status ?? "open").toLowerCase().replace(/\s+/g, "_");
  const carrier = body.carrier as Record<string, string> | undefined;
  const customer = body.customer as Record<string, string> | undefined;
  const origin = body.origin as Record<string, string> | undefined;
  const destination = body.destination as Record<string, string> | undefined;

  return {
    loadNumber,
    data: {
      currentStatus:    STATUS_MAP[rawStatus] ?? rawStatus,
      carrierName:      carrier?.name ?? body.carrier_name ?? null,
      customerName:     customer?.name ?? body.customer_name ?? null,
      originCity:       origin?.city ?? body.origin_city ?? null,
      originState:      origin?.state ?? body.origin_state ?? null,
      destinationCity:  destination?.city ?? body.destination_city ?? null,
      destinationState: destination?.state ?? body.destination_state ?? null,
      pickupAt:         parseDate(String(body.pickupAt ?? body.pickup_at ?? "")),
      eta:              parseDate(String(body.eta ?? body.deliveryAt ?? body.delivery_at ?? "")),
      riskLevel:        RISK_MAP[String(body.riskLevel ?? body.risk_level ?? "")] ?? "normal",
    },
  };
}

export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { loads?: LoadPayload[] };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const payloads = body.loads;
  if (!Array.isArray(payloads) || payloads.length === 0) {
    return NextResponse.json({ error: "Provide { loads: [...] } with at least one load" }, { status: 422 });
  }
  if (payloads.length > 500) {
    return NextResponse.json({ error: "Maximum 500 loads per batch" }, { status: 422 });
  }

  const { tenantId } = auth;
  const results: { loadNumber: string; id?: string; action?: string; error?: string }[] = [];

  // Fetch all existing loads for this tenant in one query to minimize round trips
  const allLoadNumbers = payloads
    .map((p) => String(p.loadNumber ?? p.load_number ?? "").toUpperCase().trim())
    .filter(Boolean);

  const existing = await db.query.loads.findMany({
    where: eq(loads.tenantId, tenantId),
    columns: { id: true, loadNumber: true, carrierName: true, customerName: true,
               originCity: true, originState: true, destinationCity: true, destinationState: true,
               pickupAt: true, eta: true },
  });
  const existingMap = new Map(existing.map((l) => [l.loadNumber, l]));

  for (const payload of payloads) {
    const normalized = normalize(payload);
    if ("error" in normalized) {
      results.push({ loadNumber: String(payload.loadNumber ?? payload.load_number ?? "unknown"), error: normalized.error });
      continue;
    }

    const { loadNumber, data } = normalized;
    const existing_ = existingMap.get(loadNumber);

    try {
      if (existing_) {
        await db.update(loads).set({
          currentStatus: data.currentStatus as string,
          carrierName:   (data.carrierName as string | null) ?? existing_.carrierName,
          customerName:  (data.customerName as string | null) ?? existing_.customerName,
          originCity:    (data.originCity as string | null) ?? existing_.originCity,
          originState:   (data.originState as string | null) ?? existing_.originState,
          destinationCity:  (data.destinationCity as string | null) ?? existing_.destinationCity,
          destinationState: (data.destinationState as string | null) ?? existing_.destinationState,
          pickupAt:  (data.pickupAt as Date | null) ?? existing_.pickupAt,
          eta:       (data.eta as Date | null) ?? existing_.eta,
          riskLevel: (data.riskLevel as "low" | "normal" | "high" | "critical") ?? "normal",
        }).where(eq(loads.id, existing_.id));
        results.push({ loadNumber, id: existing_.id, action: "updated" });
      } else {
        const [inserted] = await db.insert(loads).values({
          tenantId,
          loadNumber,
          currentStatus:   data.currentStatus as string,
          carrierName:     (data.carrierName as string) ?? "",
          customerName:    data.customerName as string | null,
          originCity:      (data.originCity as string) ?? "",
          originState:     (data.originState as string) ?? "",
          destinationCity: (data.destinationCity as string) ?? "",
          destinationState: (data.destinationState as string) ?? "",
          pickupAt:  data.pickupAt as Date | null,
          eta:       data.eta as Date | null,
          riskLevel: (data.riskLevel as "low" | "normal" | "high" | "critical") ?? "normal",
        }).returning({ id: loads.id });
        results.push({ loadNumber, id: inserted.id, action: "created" });
        existingMap.set(loadNumber, { id: inserted.id, loadNumber, carrierName: data.carrierName as string | null, customerName: data.customerName as string | null, originCity: data.originCity as string | null, originState: data.originState as string | null, destinationCity: data.destinationCity as string | null, destinationState: data.destinationState as string | null, pickupAt: data.pickupAt as Date | null, eta: data.eta as Date | null });
      }
    } catch (e) {
      results.push({ loadNumber, error: (e as Error).message });
    }
  }

  const created = results.filter((r) => r.action === "created").length;
  const updated = results.filter((r) => r.action === "updated").length;
  const errors  = results.filter((r) => r.error).length;

  return NextResponse.json({ summary: { total: payloads.length, created, updated, errors }, results });
}
