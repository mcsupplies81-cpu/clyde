import { NextResponse } from "next/server";
import { getGmailAuthUrl } from "@/lib/gmail";

export async function GET() {
  const tenantId = process.env.DEMO_TENANT_ID ?? "";
  if (!tenantId) {
    return NextResponse.json({ error: "DEMO_TENANT_ID is not configured" }, { status: 500 });
  }

  return NextResponse.redirect(getGmailAuthUrl(tenantId));
}
