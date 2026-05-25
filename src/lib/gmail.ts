import { google } from "googleapis";

export function getGmailClient(_tenantId: string) {
  return google.gmail({ version: "v1" });
}
