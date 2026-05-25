import crypto from "node:crypto";
import { google } from "googleapis";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { inboxConnections } from "@/db/schema";

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
];

function getTokenSecret() {
  const secret = process.env.GMAIL_TOKEN_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("GMAIL_TOKEN_SECRET must be at least 32 characters");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptToken(plain: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getTokenSecret(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptToken(payload: string) {
  const [ivB64, tagB64, dataB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Invalid encrypted token payload");
  const decipher = crypto.createDecipheriv("aes-256-gcm", getTokenSecret(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}

export function getOAuthClient() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    throw new Error("Google OAuth env vars are missing");
  }

  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
}

export function getGmailAuthUrl(state: string) {
  return getOAuthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GMAIL_SCOPES,
    state,
  });
}

export async function refreshToken(connectionId: string, refreshTokenValue: string) {
  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({ refresh_token: refreshTokenValue });
  const { credentials } = await oauth2Client.refreshAccessToken();

  if (!credentials.access_token || !credentials.expiry_date) {
    throw new Error("Failed to refresh Gmail access token");
  }

  await db
    .update(inboxConnections)
    .set({
      accessToken: encryptToken(credentials.access_token),
      tokenExpiry: new Date(credentials.expiry_date),
    })
    .where(eq(inboxConnections.id, connectionId));

  return credentials;
}

export async function getGmailClient(tenantId: string) {
  const connection = await db.query.inboxConnections.findFirst({
    where: and(eq(inboxConnections.tenantId, tenantId), eq(inboxConnections.provider, "gmail")),
  });

  if (!connection) throw new Error("No Gmail connection found for tenant");

  const oauth2Client = getOAuthClient();
  const refreshTokenValue = decryptToken(connection.refreshToken);
  let accessTokenValue = decryptToken(connection.accessToken);

  if (connection.tokenExpiry.getTime() <= Date.now() + 60_000) {
    const refreshed = await refreshToken(connection.id, refreshTokenValue);
    accessTokenValue = refreshed.access_token as string;
  }

  oauth2Client.setCredentials({
    access_token: accessTokenValue,
    refresh_token: refreshTokenValue,
  });

  return google.gmail({ version: "v1", auth: oauth2Client });
}
