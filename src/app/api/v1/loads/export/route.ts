/**
 * GET /api/v1/loads/export
 * Returns a CSV of all loads for the authenticated tenant.
 * Authenticated via Clerk session (browser download).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { loads } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getTenantIdForUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const tenantId = await getTenantIdForUser();
  if (!tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allLoads = await db.query.loads.findMany({
    where: eq(loads.tenantId, tenantId),
    columns: {
      loadNumber: true, poNumber: true, customerName: true, carrierName: true,
      originCity: true, originState: true, destinationCity: true, destinationState: true,
      currentStatus: true, pickupAt: true, deliveryAt: true, eta: true,
      driverName: true, driverPhone: true, equipmentType: true, rate: true, riskLevel: true,
      createdAt: true,
    },
  });

  const headers = [
    "Load #", "PO #", "Customer", "Carrier", "Origin", "Destination",
    "Status", "Pickup", "Delivery", "ETA", "Driver", "Driver Phone",
    "Equipment", "Rate ($)", "Risk", "Created",
  ];

  const fmt = (d: Date | null | undefined) =>
    d ? new Date(d).toLocaleDateString("en-US") : "";

  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

  const rows = allLoads.map((l) => [
    l.loadNumber,
    l.poNumber ?? "",
    l.customerName ?? "",
    l.carrierName ?? "",
    [l.originCity, l.originState].filter(Boolean).join(", "),
    [l.destinationCity, l.destinationState].filter(Boolean).join(", "),
    l.currentStatus ?? "",
    fmt(l.pickupAt),
    fmt(l.deliveryAt),
    fmt(l.eta),
    l.driverName ?? "",
    l.driverPhone ?? "",
    l.equipmentType ?? "",
    l.rate ?? "",
    l.riskLevel ?? "",
    fmt(l.createdAt),
  ].map(esc).join(","));

  const csv = [headers.map(esc).join(","), ...rows].join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="clyde-loads-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
