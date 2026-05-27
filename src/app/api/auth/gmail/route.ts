import { NextResponse } from "next/server";
import { getGmailAuthUrl } from "@/lib/gmail";
import { getTenantIdForUser } from "@/lib/auth";

export async function GET() {
  const tenantId = await getTenantIdForUser();
  if (!tenantId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  return NextResponse.redirect(getGmailAuthUrl(tenantId));
}
