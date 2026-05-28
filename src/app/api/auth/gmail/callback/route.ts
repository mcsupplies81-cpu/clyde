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

  // Find any inbox for this tenant — provider doesn't have to be 'gmail',
  // we store the OAuth tokens in inbox_connections separately.
  const inbox = await db.query.inboxes.findFirst({
    where: eq(inboxes.tenantId, tenantId),
    orderBy: [asc(inboxes.createdAt)],
  });

  if (!inbox) {
    return NextResponse.redirect(new URL("/app/settings?gmail=no_inbox", request.url));
  }

  try {
    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token || !tokens.expiry_date) {
      return NextResponse.redirect(new URL("/app/settings?gmail=missing_tokens", request.url));
    }

    // getTokenInfo uses the access token itself to retrieve the email —
    // no extra userinfo scope needed.
    const tokenInfo = await oauth2Client.getTokenInfo(tokens.access_token);
    const gmailEmail = tokenInfo.email ?? inbox.emailAddress;

    const existing = await db.query.inboxConnections.findFirst({
      where: and(
        eq(inboxConnections.tenantId, tenantId),
        eq(inboxConnections.inboxId, inbox.id),
        eq(inboxConnections.provider, "gmail"),
      ),
    });

    if (existing) {
      await db.update(inboxConnections).set({
        gmailEmail,
        accessToken: encryptToken(tokens.access_token),
        refreshToken: tokens.refresh_token ? encryptToken(tokens.refresh_token) : existing.refreshToken,
        tokenExpiry: new Date(tokens.expiry_date),
      }).where(eq(inboxConnections.id, existing.id));
    } else {
      if (!tokens.refresh_token) {
        // refresh_token is only returned on first consent; redirect user to re-authorize
        return NextResponse.redirect(new URL("/app/settings?gmail=reauth_required", request.url));
      }
      await db.insert(inboxConnections).values({
        tenantId,
        inboxId: inbox.id,
        provider: "gmail",
        gmailEmail,
        accessToken: encryptToken(tokens.access_token),
        refreshToken: encryptToken(tokens.refresh_token),
        tokenExpiry: new Date(tokens.expiry_date),
      });
    }

    return NextResponse.redirect(new URL("/app/settings?gmail=connected", request.url));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.error("[gmail-callback] error:", msg);
    // Redirect cleanly instead of crashing with 500
    return NextResponse.redirect(
      new URL(`/app/settings?gmail=auth_failed&reason=${encodeURIComponent(msg)}`, request.url),
    );
  }
}
