"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { loads } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getTenantIdForUser } from "@/lib/auth";

export async function addLoadAction(formData: FormData): Promise<{ error?: string; id?: string }> {
  const tenantId = await getTenantIdForUser();
  if (!tenantId) return { error: "Not authenticated" };

  const loadNumber = String(formData.get("loadNumber") ?? "").trim();
  if (!loadNumber) return { error: "Load number is required" };

  // Check duplicate
  const existing = await db.query.loads.findFirst({
    where: and(eq(loads.loadNumber, loadNumber), eq(loads.tenantId, tenantId)),
    columns: { id: true },
  });
  if (existing) return { error: `Load #${loadNumber} already exists` };

  const pickupRaw   = String(formData.get("pickupAt") ?? "").trim();
  const deliveryRaw = String(formData.get("deliveryAt") ?? "").trim();
  const rateRaw     = String(formData.get("rate") ?? "").trim();

  const [inserted] = await db.insert(loads).values({
    tenantId,
    loadNumber,
    poNumber:        String(formData.get("poNumber") ?? "").trim() || null,
    customerName:    String(formData.get("customerName") ?? "").trim() || null,
    carrierName:     String(formData.get("carrierName") ?? "").trim() || null,
    originCity:      String(formData.get("originCity") ?? "").trim() || null,
    originState:     String(formData.get("originState") ?? "").trim().toUpperCase() || null,
    destinationCity: String(formData.get("destinationCity") ?? "").trim() || null,
    destinationState:String(formData.get("destinationState") ?? "").trim().toUpperCase() || null,
    currentStatus:   String(formData.get("currentStatus") ?? "Booked").trim() || "Booked",
    pickupAt:        pickupRaw ? new Date(pickupRaw) : null,
    deliveryAt:      deliveryRaw ? new Date(deliveryRaw) : null,
    driverName:      String(formData.get("driverName") ?? "").trim() || null,
    driverPhone:     String(formData.get("driverPhone") ?? "").trim() || null,
    equipmentType:   String(formData.get("equipmentType") ?? "").trim() || null,
    rate:            rateRaw ? rateRaw : null,
    riskLevel:       String(formData.get("riskLevel") ?? "low").trim() || "low",
  }).returning({ id: loads.id });

  revalidatePath("/app/loads");
  return { id: inserted.id };
}

export async function exportLoadsAction(): Promise<string> {
  const tenantId = await getTenantIdForUser();
  if (!tenantId) return "";

  const allLoads = await db.query.loads.findMany({
    where: eq(loads.tenantId, tenantId),
    columns: {
      loadNumber: true, poNumber: true, customerName: true, carrierName: true,
      originCity: true, originState: true, destinationCity: true, destinationState: true,
      currentStatus: true, pickupAt: true, deliveryAt: true, eta: true,
      driverName: true, driverPhone: true, equipmentType: true, rate: true, riskLevel: true,
    },
  });

  const headers = [
    "Load #", "PO #", "Customer", "Carrier", "Origin", "Destination",
    "Status", "Pickup", "Delivery", "ETA", "Driver", "Driver Phone",
    "Equipment", "Rate", "Risk",
  ];

  const fmt = (d: Date | null | undefined) =>
    d ? new Date(d).toLocaleDateString("en-US") : "";

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
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));

  return [headers.join(","), ...rows].join("\n");
}
