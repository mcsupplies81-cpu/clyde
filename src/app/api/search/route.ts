import { getTenantIdForUser } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { emailThreads, loads, aiClassifications, emailMessages } from "@/db/schema";
import { and, eq, ilike, or, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const tenantId = await getTenantIdForUser();
  if (!tenantId) return NextResponse.json({ threads: [], loads: [] });

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ threads: [], loads: [] });

  const pattern = `%${q}%`;

  const [threadResults, loadResults] = await Promise.all([
    db
      .select({
        id: emailThreads.id,
        subject: emailThreads.subject,
        customerName: emailThreads.customerName,
        status: emailThreads.status,
        priority: emailThreads.priority,
        lastMessageAt: emailThreads.lastMessageAt,
      })
      .from(emailThreads)
      .where(
        and(
          eq(emailThreads.tenantId, tenantId),
          or(
            ilike(emailThreads.subject, pattern),
            ilike(emailThreads.customerName, pattern),
            ilike(emailThreads.carrierName, pattern),
          ),
        ),
      )
      .orderBy(desc(emailThreads.lastMessageAt))
      .limit(6),

    db
      .select({
        id: loads.id,
        loadNumber: loads.loadNumber,
        customerName: loads.customerName,
        carrierName: loads.carrierName,
        originCity: loads.originCity,
        originState: loads.originState,
        destinationCity: loads.destinationCity,
        destinationState: loads.destinationState,
        currentStatus: loads.currentStatus,
        riskLevel: loads.riskLevel,
      })
      .from(loads)
      .where(
        and(
          eq(loads.tenantId, tenantId),
          or(
            ilike(loads.loadNumber, pattern),
            ilike(loads.customerName, pattern),
            ilike(loads.carrierName, pattern),
            ilike(loads.originCity, pattern),
            ilike(loads.destinationCity, pattern),
            ilike(loads.poNumber, pattern),
          ),
        ),
      )
      .orderBy(desc(loads.pickupAt))
      .limit(6),
  ]);

  return NextResponse.json({
    threads: threadResults,
    loads: loadResults,
  });
}
