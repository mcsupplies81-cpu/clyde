import { NextResponse } from "next/server";
import { getGmailAuthUrl } from "@/lib/gmail";
import { getTenantIdForUser } from "@/lib/auth";

export async function GET() {
  try {
    const tenantId = await getTenantIdForUser();
    if (!tenantId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    return NextResponse.redirect(getGmailAuthUrl(tenantId));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "OAuth config error";
    console.error("[gmail-auth] error:", msg);
    return NextResponse.redirect(
      new URL(`/app/settings?gmail=config_error`, "https://repo-two-nu.vercel.app"),
    );
  }
}
