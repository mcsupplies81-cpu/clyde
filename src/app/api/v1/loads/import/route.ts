import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { loads } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getTenantIdForUser } from "@/lib/auth";

// Column name → load field mapping (case-insensitive, flexible aliases)
const COLUMN_MAP: Record<string, keyof typeof FIELD_DEFAULTS> = {
  // Load number
  "load number": "loadNumber", "load#": "loadNumber", "load_number": "loadNumber",
  "load no": "loadNumber", "load id": "loadNumber", "reference": "loadNumber",
  "ref": "loadNumber", "order number": "loadNumber", "order#": "loadNumber",
  // PO number
  "po number": "poNumber", "po#": "poNumber", "po_number": "poNumber",
  "purchase order": "poNumber", "po": "poNumber",
  // Customer
  "customer": "customerName", "customer name": "customerName", "shipper": "customerName",
  "bill to": "customerName", "client": "customerName",
  // Carrier
  "carrier": "carrierName", "carrier name": "carrierName", "trucking company": "carrierName",
  "motor carrier": "carrierName",
  // Carrier email
  "carrier email": "carrierEmail", "carrier_email": "carrierEmail", "driver email": "carrierEmail",
  // Origin
  "origin city": "originCity", "origin_city": "originCity", "pickup city": "originCity",
  "from city": "originCity", "shipper city": "originCity",
  "origin state": "originState", "origin_state": "originState", "pickup state": "originState",
  "from state": "originState", "shipper state": "originState",
  // Destination
  "destination city": "destinationCity", "destination_city": "destinationCity",
  "delivery city": "destinationCity", "to city": "destinationCity", "consignee city": "destinationCity",
  "destination state": "destinationState", "destination_state": "destinationState",
  "delivery state": "destinationState", "to state": "destinationState",
  // Dates
  "pickup date": "pickupAt", "pickup_date": "pickupAt", "pickup": "pickupAt",
  "ship date": "pickupAt", "origin date": "pickupAt",
  "delivery date": "deliveryAt", "delivery_date": "deliveryAt", "delivery": "deliveryAt",
  "eta": "eta", "estimated delivery": "eta",
  // Status
  "status": "currentStatus", "load status": "currentStatus", "shipment status": "currentStatus",
  // Driver
  "driver": "driverName", "driver name": "driverName", "driver_name": "driverName",
  "driver phone": "driverPhone", "driver_phone": "driverPhone", "driver cell": "driverPhone",
  // Equipment
  "equipment": "equipmentType", "equipment type": "equipmentType", "trailer type": "equipmentType",
  "mode": "equipmentType",
  // Rate
  "rate": "rate", "linehaul": "rate", "line haul": "rate", "total rate": "rate",
  "carrier pay": "rate", "gross revenue": "rate",
  // Notes
  "notes": "internalNotes", "internal notes": "internalNotes", "comments": "internalNotes",
};

const FIELD_DEFAULTS = {
  loadNumber: "", poNumber: "", customerName: "", carrierName: "", carrierEmail: "",
  originCity: "", originState: "", destinationCity: "", destinationState: "",
  pickupAt: "", deliveryAt: "", eta: "", currentStatus: "",
  driverName: "", driverPhone: "", equipmentType: "", rate: "", internalNotes: "",
};

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  for (const line of lines) {
    if (!line.trim()) continue;
    const cells: string[] = [];
    let inQuotes = false;
    let cell = "";
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cell += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (ch === "," && !inQuotes) {
        cells.push(cell.trim());
        cell = "";
      } else {
        cell += ch;
      }
    }
    cells.push(cell.trim());
    rows.push(cells);
  }
  return rows;
}

function parseDate(val: string): Date | null {
  if (!val) return null;
  const d = new Date(val);
  if (!isNaN(d.getTime())) return d;
  // Try M/D/YYYY
  const mdy = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) return new Date(`${mdy[3]}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`);
  return null;
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenantId = await getTenantIdForUser();
  if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 });

  let csvText: string;
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    csvText = await (file as File).text();
  } else {
    csvText = await request.text();
  }

  const rows = parseCSV(csvText);
  if (rows.length < 2) return NextResponse.json({ error: "CSV must have at least a header row and one data row" }, { status: 400 });

  // Map header columns
  const headers = rows[0].map((h) => h.toLowerCase().trim());
  const colIndex: Partial<Record<keyof typeof FIELD_DEFAULTS, number>> = {};
  for (let i = 0; i < headers.length; i++) {
    const mapped = COLUMN_MAP[headers[i]];
    if (mapped && colIndex[mapped] === undefined) {
      colIndex[mapped] = i;
    }
  }

  if (colIndex.loadNumber === undefined) {
    return NextResponse.json({ error: "CSV must have a 'Load Number' (or 'load#', 'reference', etc.) column" }, { status: 400 });
  }

  const dataRows = rows.slice(1);
  let imported = 0;
  let skipped = 0;
  let duplicates = 0;
  const errors: string[] = [];

  for (let rowIdx = 0; rowIdx < dataRows.length; rowIdx++) {
    const row = dataRows[rowIdx];
    const get = (field: keyof typeof FIELD_DEFAULTS) => {
      const idx = colIndex[field];
      return idx !== undefined ? (row[idx] ?? "").trim() : "";
    };

    const loadNumber = get("loadNumber");
    if (!loadNumber) { skipped++; continue; }

    // Check for duplicate
    const existing = await db.query.loads.findFirst({
      where: and(eq(loads.tenantId, tenantId), eq(loads.loadNumber, loadNumber)),
      columns: { id: true },
    });
    if (existing) { duplicates++; continue; }

    const rateRaw = get("rate").replace(/[$,\s]/g, "");
    const rate = rateRaw && !isNaN(Number(rateRaw)) ? rateRaw : null;

    try {
      await db.insert(loads).values({
        tenantId,
        loadNumber,
        poNumber:         get("poNumber") || null,
        customerName:     get("customerName") || null,
        carrierName:      get("carrierName") || null,
        originCity:       get("originCity") || null,
        originState:      get("originState") || null,
        destinationCity:  get("destinationCity") || null,
        destinationState: get("destinationState") || null,
        currentStatus:    get("currentStatus") || "Booked",
        pickupAt:         parseDate(get("pickupAt")),
        deliveryAt:       parseDate(get("deliveryAt")),
        eta:              parseDate(get("eta")),
        driverName:       get("driverName") || null,
        driverPhone:      get("driverPhone") || null,
        equipmentType:    get("equipmentType") || null,
        rate:             rate,
        internalNotes:    get("internalNotes") || null,
        riskLevel:        "low",
      });
      imported++;
    } catch (err) {
      errors.push(`Row ${rowIdx + 2}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  return NextResponse.json({ imported, skipped, duplicates, errors, total: dataRows.length });
}
