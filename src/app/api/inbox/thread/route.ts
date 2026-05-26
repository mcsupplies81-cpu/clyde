import { NextRequest, NextResponse } from "next/server";
import { fetchThreadDetail } from "@/lib/inbox-thread-detail";

export async function GET(req: NextRequest) {
  const threadId = req.nextUrl.searchParams.get("threadId");
  const tenantId = process.env.DEMO_TENANT_ID ?? "";

  if (!threadId || !tenantId) {
    return NextResponse.json({ error: "missing params" }, { status: 400 });
  }

  const detail = await fetchThreadDetail(tenantId, threadId);
  return NextResponse.json(detail, {
    headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=30" },
  });
}
