import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { inboxConnections, inboxes } from "@/db/schema";
import { encryptToken, getOAuthClient } from "@/lib/gmail";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const tenantId = request.nextUrl.searchParams.get("state") ?? process.env.DEMO_TENANT_ID ?? "";

  if (!code || !tenantId) {
    return NextResponse.redirect(new URL("/app/settings?gmail=error", request.url));
  }

  const inbox = await db.query.inboxes.findFirst({
    where: and(eq(inboxes.tenantId, tenantId), eq(inboxes.provider, "gmail")),
    orderBy: [asc(inboxes.createdAt)],
  });

  if (!inbox) {
    return NextResponse.redirect(new URL("/app/settings?gmail=no_inbox", request.url));
  }

  const oauth2Client = getOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  if (!tokens.access_token || !tokens.expiry_date) {
    return NextResponse.redirect(new URL("/app/settings?gmail=missing_tokens", request.url));
  }

  const profile = await oauth2Client.request<{ email: string }>({ url: "https://www.googleapis.com/oauth2/v2/userinfo" });

  const existing = await db.query.inboxConnections.findFirst({
    where: and(eq(inboxConnections.tenantId, tenantId), eq(inboxConnections.inboxId, inbox.id), eq(inboxConnections.provider, "gmail")),
  });

  if (existing) {
    await db.update(inboxConnections).set({
      gmailEmail: profile.data.email ?? inbox.emailAddress,
      accessToken: encryptToken(tokens.access_token),
      refreshToken: tokens.refresh_token ? encryptToken(tokens.refresh_token) : existing.refreshToken,
      tokenExpiry: new Date(tokens.expiry_date),
    }).where(eq(inboxConnections.id, existing.id));
  } else {
    if (!tokens.refresh_token) {
      return NextResponse.redirect(new URL("/app/settings?gmail=missing_refresh_token", request.url));
    }
    await db.insert(inboxConnections).values({
      tenantId,
      inboxId: inbox.id,
      provider: "gmail",
      gmailEmail: profile.data.email ?? inbox.emailAddress,
      accessToken: encryptToken(tokens.access_token),
      refreshToken: encryptToken(tokens.refresh_token),
      tokenExpiry: new Date(tokens.expiry_date),
    });
  }

  return NextResponse.redirect(new URL("/app/settings?gmail=connected", request.url));
}
