import { db } from "@/db";
import { aiDrafts, auditLogs, emailMessages } from "@/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";

export async function getAvgResponseTime(tenantId: string, windowDays?: number) {
  const whereClauses = [
    eq(emailMessages.tenantId, tenantId),
    eq(emailMessages.direction, "inbound"),
    eq(aiDrafts.tenantId, tenantId),
    sql`${emailMessages.receivedAt} is not null`,
  ];

  if (windowDays) {
    whereClauses.push(gte(emailMessages.receivedAt, sql`now() - (${windowDays} * interval '1 day')`));
  }

  const [row] = await db
    .select({
      avgMinutes: sql<number>`coalesce(avg(extract(epoch from (${aiDrafts.updatedAt} - ${emailMessages.receivedAt})) / 60.0), 0)::float`,
    })
    .from(aiDrafts)
    .innerJoin(emailMessages, eq(aiDrafts.messageId, emailMessages.id))
    .where(and(...whereClauses));

  return Number(row?.avgMinutes ?? 0);
}

export async function getResponseTimeByAudit(tenantId: string, windowDays?: number) {
  const windowFilter = windowDays
    ? sql`and inbound.received_at >= now() - (${windowDays} * interval '1 day')`
    : sql``;

  const [row] = await db.execute(sql`
    with sent_events as (
      select
        al.tenant_id,
        coalesce((al.metadata->>'messageId')::uuid, al.entity_id::uuid) as message_id,
        al.created_at as sent_at
      from ${auditLogs} al
      where al.tenant_id = ${tenantId}
        and al.action in ('message_sent', 'mark_sent_manually', 'autopilot_auto_sent')
    )
    select coalesce(avg(extract(epoch from (se.sent_at - inbound.received_at)) / 60.0), 0)::float as avg_minutes
    from sent_events se
    join ${emailMessages} inbound
      on inbound.id = se.message_id
     and inbound.tenant_id = ${tenantId}
     and inbound.direction = 'inbound'
    where inbound.received_at is not null
    ${windowFilter}
  `);

  return Number((row as { avg_minutes?: number } | undefined)?.avg_minutes ?? 0);
}
