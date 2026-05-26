/**
 * Clyde TMS Integration API — /api/v1/loads
 *
 * Universal endpoint: push load data from any TMS, CRM, or tracking system.
 * No per-integration setup needed — one endpoint, any source.
 *
 * Authentication: Authorization: Bearer <api-key>
 *
 * POST /api/v1/loads   — create or update a load (upsert on loadNumber)
 * GET  /api/v1/loads   — list loads for this tenant
 */

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { db } from "@/db";
import { apiKeys, loads } from "@/db/schema";
import { and, eq } from "drizzle-orm";

// ── Auth helper ────────────────────────────────────────────────────────────────

async function authenticate(req: NextRequest): Promise<{ tenantId: string } | null> {
  const auth = req.headers.get("authorization") ?? "";
  const raw  = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!raw) return null;

  const hash = createHash("sha256").update(raw).digest("hex");
  const key  = await db.query.apiKeys.findFirst({
    where: and(eq(apiKeys.keyHash, hash), eq(apiKeys.isActive, true)),
  });
  if (!key) return null;

  // Update last_used_at asynchronously — don't block the response
  db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, key.id)).catch(() => {});

  return { tenantId: key.tenantId };
}

// ── Load payload schema ────────────────────────────────────────────────────────
// Any field not listed is ignored — forward-compatible.

type LoadPayload = {
  loadNumber: string;
  status?: string;
  carrier?: { name?: string; mc?: string; dot?: string; contact?: string; phone?: string };
  customer?: { name?: string; contact?: string; email?: string };
  origin?: { city?: string; state?: string; zip?: string; address?: string };
  destination?: { city?: string; state?: string; zip?: string; address?: string };
  pickupAt?: string;       // ISO 8601
  deliveryAt?: string;     // ISO 8601
  eta?: string;            // ISO 8601
  weightLbs?: number;
  commodity?: string;
  equipment?: string;
  rate?: number;
  currency?: string;
  poNumber?: string;
  notes?: string;
  riskLevel?: "low" | "normal" | "high" | "critical";
  // Also accept snake_case keys (common from TMS webhooks)
  load_number?: string;
  carrier_name?: string;
  customer_name?: string;
  origin_city?: string; origin_state?: string;
  destination_city?: string; destination_state?: string;
  pickup_at?: string; delivery_at?: string;
  weight_lbs?: number;
  risk_level?: string;
  po_number?: string;
};

function normalize(body: LoadPayload) {
  const loadNumber = body.loadNumber ?? body.load_number ?? "";
  if (!loadNumber) throw new Error("loadNumber is required");

  // Map status to our internal status vocabulary
  const rawStatus = (body.status ?? "open").toLowerCase().replace(/\s+/g, "_");
  const STATUS_MAP: Record<string, string> = {
    booked: "open", planned: "open", open: "open",
    "picked_up": "in_transit", pickup: "in_transit", in_transit: "in_transit",
    "out_for_delivery": "in_transit",
    delivered: "delivered", pod_received: "delivered", complete: "delivered", completed: "delivered",
    exception: "exception", problem: "exception",
    cancelled: "cancelled", canceled: "cancelled",
  };
  const currentStatus = STATUS_MAP[rawStatus] ?? rawStatus;

  const RISK_MAP: Record<string, string> = { low: "low", normal: "normal", high: "high", critical: "critical" };

  return {
    loadNumber: loadNumber.toUpperCase(),
    currentStatus,
    carrierName:      body.carrier?.name ?? body.carrier_name ?? null,
    carrierMc:        body.carrier?.mc ?? null,
    customerName:     body.customer?.name ?? body.customer_name ?? null,
    originCity:       body.origin?.city ?? body.origin_city ?? null,
    originState:      body.origin?.state ?? body.origin_state ?? null,
    destinationCity:  body.destination?.city ?? body.destination_city ?? null,
    destinationState: body.destination?.state ?? body.destination_state ?? null,
    pickupAt:         parseDate(body.pickupAt ?? body.pickup_at),
    eta:              parseDate(body.eta ?? body.deliveryAt ?? body.delivery_at),
    weightLbs:        body.weightLbs ?? body.weight_lbs ?? null,
    commodity:        body.commodity ?? body.equipment ?? null,
    riskLevel:        RISK_MAP[body.riskLevel ?? body.risk_level ?? ""] ?? "normal",
    poNumber:         body.poNumber ?? body.po_number ?? null,
    notes:            body.notes ?? null,
    rate:             body.rate ? String(body.rate) : null,
  };
}

function parseDate(val: string | undefined | null): Date | null {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

// ── POST /api/v1/loads ────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized — provide a valid Bearer token" }, { status: 401 });
  }

  let body: LoadPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let data: ReturnType<typeof normalize>;
  try {
    data = normalize(body);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 422 });
  }

  const { tenantId } = auth;

  // Upsert — match on tenantId + loadNumber
  const existing = await db.query.loads.findFirst({
    where: and(eq(loads.tenantId, tenantId), eq(loads.loadNumber, data.loadNumber)),
  });

  let loadId: string;

  if (existing) {
    await db.update(loads).set({
      currentStatus: data.currentStatus,
      carrierName:   data.carrierName ?? existing.carrierName,
      customerName:  data.customerName ?? existing.customerName,
      originCity:    data.originCity ?? existing.originCity,
      originState:   data.originState ?? existing.originState,
      destinationCity:  data.destinationCity ?? existing.destinationCity,
      destinationState: data.destinationState ?? existing.destinationState,
      pickupAt:  data.pickupAt  ?? existing.pickupAt,
      eta:       data.eta       ?? existing.eta,
      riskLevel: data.riskLevel as "low" | "normal" | "high" | "critical" ?? existing.riskLevel,
    }).where(eq(loads.id, existing.id));
    loadId = existing.id;
  } else {
    const [inserted] = await db.insert(loads).values({
      tenantId,
      loadNumber:      data.loadNumber,
      currentStatus:   data.currentStatus,
      carrierName:     data.carrierName ?? "",
      customerName:    data.customerName ?? null,
      originCity:      data.originCity ?? "",
      originState:     data.originState ?? "",
      destinationCity: data.destinationCity ?? "",
      destinationState: data.destinationState ?? "",
      pickupAt:  data.pickupAt,
      eta:       data.eta,
      riskLevel: (data.riskLevel as "low" | "normal" | "high" | "critical") ?? "normal",
    }).returning({ id: loads.id });
    loadId = inserted.id;
  }

  return NextResponse.json({
    id: loadId,
    loadNumber: data.loadNumber,
    action: existing ? "updated" : "created",
    synced: true,
  });
}

// ── GET /api/v1/loads ─────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allLoads = await db.query.loads.findMany({
    where: eq(loads.tenantId, auth.tenantId),
    columns: {
      id: true, loadNumber: true, currentStatus: true,
      carrierName: true, customerName: true,
      originCity: true, originState: true,
      destinationCity: true, destinationState: true,
      pickupAt: true, eta: true, riskLevel: true,
    },
  });

  return NextResponse.json({ loads: allLoads, total: allLoads.length });
}
