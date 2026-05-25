import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { autopilotSettings } from "@/db/schema";
import { runAutopilot } from "@/lib/autopilot-runner";

function hourInTimezone(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: timezone }).formatToParts(date);
  return Number(parts.find((p) => p.type === "hour")?.value ?? "0");
}

export async function GET(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const enabled = await db.select().from(autopilotSettings).where(eq(autopilotSettings.isEnabled, true));
  const now = new Date();
  const runs: Array<Record<string, unknown>> = [];

  for (const setting of enabled) {
    const currentHour = hourInTimezone(now, setting.timezone);
    if (currentHour !== setting.scheduledHour) {
      runs.push({ tenantId: setting.tenantId, skipped: true, reason: `Hour mismatch (${currentHour} != ${setting.scheduledHour})` });
      continue;
    }

    try {
      const result = await runAutopilot(setting.tenantId);
      await db.update(autopilotSettings)
        .set({ lastRunAt: now, lastRunResult: result as Record<string, unknown> })
        .where(eq(autopilotSettings.tenantId, setting.tenantId));
      runs.push({ tenantId: setting.tenantId, ran: true, result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await db.update(autopilotSettings)
        .set({ lastRunAt: now, lastRunResult: { error: message } })
        .where(eq(autopilotSettings.tenantId, setting.tenantId));
      runs.push({ tenantId: setting.tenantId, ran: true, error: message });
    }
  }

  return NextResponse.json({ ranAt: now.toISOString(), totalEnabled: enabled.length, runs });
}
