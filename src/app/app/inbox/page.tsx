import { getTenantIdForUser } from "@/lib/auth";
import { unstable_cache } from "next/cache";
import { db } from "@/db";
import {
  emailThreads, emailMessages, loads,
  aiClassifications, aiDrafts, inboxConnections,
} from "@/db/schema";
import { eq, desc, and, inArray } from "drizzle-orm";
import { fetchThreadDetail } from "@/lib/inbox-thread-detail";
import { InboxRoot } from "./InboxRoot";

// ─── Filter types ─────────────────────────────────────────────────────────────

type InboxFilter =
  | "all" | "needs_review" | "ready_to_send" | "sent" | "escalated" | "resolved" | "urgent"
  | "pod_request" | "bol_request" | "quote_request" | "status_request" | "appointment_change" | "carrier_concern";

// ─── Thread list query (filter-specific) ──────────────────────────────────────

async function getThreadsForFilter(tenantId: string, filter: InboxFilter | undefined) {
  const base = { tenantId: eq(emailThreads.tenantId, tenantId) };

  if (filter === "needs_review") {
    const rows = await db
      .select({ threadId: emailMessages.threadId })
      .from(aiDrafts)
      .innerJoin(emailMessages, eq(aiDrafts.messageId, emailMessages.id))
      .where(and(eq(aiDrafts.tenantId, tenantId), inArray(aiDrafts.status, ["pending", "edited"])));
    const ids = [...new Set(rows.map((r) => r.threadId))];
    return ids.length
      ? db.query.emailThreads.findMany({ where: and(base.tenantId, inArray(emailThreads.id, ids)), orderBy: [desc(emailThreads.lastMessageAt)] })
      : [];
  }

  if (filter === "ready_to_send") {
    const rows = await db
      .select({ threadId: emailMessages.threadId })
      .from(aiDrafts)
      .innerJoin(emailMessages, eq(aiDrafts.messageId, emailMessages.id))
      .where(and(eq(aiDrafts.tenantId, tenantId), eq(aiDrafts.status, "approved")));
    const ids = [...new Set(rows.map((r) => r.threadId))];
    return ids.length
      ? db.query.emailThreads.findMany({ where: and(base.tenantId, inArray(emailThreads.id, ids)), orderBy: [desc(emailThreads.lastMessageAt)] })
      : [];
  }

  if (filter === "sent")      return db.query.emailThreads.findMany({ where: and(base.tenantId, eq(emailThreads.status, "sent")),      orderBy: [desc(emailThreads.lastMessageAt)] });
  if (filter === "escalated") return db.query.emailThreads.findMany({ where: and(base.tenantId, eq(emailThreads.status, "escalated")), orderBy: [desc(emailThreads.lastMessageAt)] });
  if (filter === "resolved")  return db.query.emailThreads.findMany({ where: and(base.tenantId, eq(emailThreads.status, "resolved")),  orderBy: [desc(emailThreads.lastMessageAt)] });
  if (filter === "urgent")    return db.query.emailThreads.findMany({ where: and(base.tenantId, eq(emailThreads.priority, "urgent")),  orderBy: [desc(emailThreads.lastMessageAt)] });

  // Category-based filters — find threads whose latest classification matches a category
  const CATEGORY_FILTERS: Partial<Record<InboxFilter, string>> = {
    pod_request: "pod_request",
    bol_request: "bol_request",
    quote_request: "quote_request",
    status_request: "status_request",
    appointment_change: "appointment_change",
    carrier_concern: "carrier_concern",
  };
  if (filter && CATEGORY_FILTERS[filter]) {
    const category = CATEGORY_FILTERS[filter];
    const rows = await db
      .select({ threadId: emailMessages.threadId })
      .from(aiClassifications)
      .innerJoin(emailMessages, eq(aiClassifications.messageId, emailMessages.id))
      .where(and(eq(aiClassifications.tenantId, tenantId), eq(aiClassifications.category, category!)));
    const ids = [...new Set(rows.map((r) => r.threadId))];
    return ids.length
      ? db.query.emailThreads.findMany({ where: and(base.tenantId, inArray(emailThreads.id, ids)), orderBy: [desc(emailThreads.lastMessageAt)] })
      : [];
  }

  return db.query.emailThreads.findMany({ where: base.tenantId, orderBy: [desc(emailThreads.lastMessageAt)], limit: 60 });
}

// ─── Cached thread list (60-second TTL) ───────────────────────────────────────

const getCachedThreadListData = unstable_cache(
  async (tenantId: string, filterKey: string) => {
    const filter = filterKey === "all" ? undefined : (filterKey as InboxFilter);
    const threads = await getThreadsForFilter(tenantId, filter);
    const threadIds = threads.map((t) => t.id);

    if (!threadIds.length) {
      return {
        threads,
        firstMsgByThread: {} as Record<string, typeof emailMessages.$inferSelect>,
        clsByMsg: {} as Record<string, typeof aiClassifications.$inferSelect>,
        latestDraftByMsg: {} as Record<string, typeof aiDrafts.$inferSelect>,
        loadByNumber: {} as Record<string, string>,
      };
    }

    const allFirstMessages = await db.select().from(emailMessages).where(
      and(eq(emailMessages.tenantId, tenantId), inArray(emailMessages.threadId, threadIds), eq(emailMessages.direction, "inbound")),
    );

    const firstMsgByThread: Record<string, typeof allFirstMessages[0]> = {};
    for (const msg of allFirstMessages) {
      if (!firstMsgByThread[msg.threadId]) firstMsgByThread[msg.threadId] = msg;
    }
    const firstMsgIds = Object.values(firstMsgByThread).map((m) => m.id);

    const [allClassifications, allDrafts] = await Promise.all([
      firstMsgIds.length
        ? db.select().from(aiClassifications).where(inArray(aiClassifications.messageId, firstMsgIds))
        : Promise.resolve([] as typeof aiClassifications.$inferSelect[]),
      firstMsgIds.length
        ? db.select().from(aiDrafts).where(inArray(aiDrafts.messageId, firstMsgIds)).orderBy(desc(aiDrafts.createdAt))
        : Promise.resolve([] as typeof aiDrafts.$inferSelect[]),
    ]);

    const clsByMsg: Record<string, typeof aiClassifications.$inferSelect> = {};
    for (const c of allClassifications) clsByMsg[c.messageId] = c;
    const latestDraftByMsg: Record<string, typeof aiDrafts.$inferSelect> = {};
    for (const d of allDrafts) { if (!latestDraftByMsg[d.messageId]) latestDraftByMsg[d.messageId] = d; }

    const loadNumbers = allClassifications.map((c) => c.extractedLoadNumber).filter(Boolean) as string[];
    const matchedLoadsRaw = loadNumbers.length
      ? await db.select({ id: loads.id, loadNumber: loads.loadNumber }).from(loads).where(
          and(inArray(loads.loadNumber, loadNumbers), eq(loads.tenantId, tenantId)),
        )
      : [];
    const loadByNumber: Record<string, string> = {};
    for (const l of matchedLoadsRaw) loadByNumber[l.loadNumber] = l.id;

    return { threads, firstMsgByThread, clsByMsg, latestDraftByMsg, loadByNumber };
  },
  ["thread-list"],
  { revalidate: 60 },
);

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ threadId?: string; filter?: string }> }) {
  const { threadId, filter: rawFilter } = await searchParams;
  const tenantId = await getTenantIdForUser();

  if (!tenantId) {
    return (
      <div style={{ padding: 40, color: "#DC2626" }}>
        <strong>DEMO_TENANT_ID not set.</strong> Run <code>npm run db:seed</code>.
      </div>
    );
  }

  const validFilters: InboxFilter[] = [
    "all", "needs_review", "ready_to_send", "sent", "escalated", "resolved",
    "urgent", "carrier_concern",
    "pod_request", "bol_request", "quote_request", "status_request", "appointment_change",
  ];
  const filter = validFilters.includes(rawFilter as InboxFilter) ? (rawFilter as InboxFilter) : undefined;

  // Fetch thread list (cached) + connection in parallel
  const [listData, connection] = await Promise.all([
    getCachedThreadListData(tenantId, filter ?? "all"),
    db.query.inboxConnections.findFirst({
      where: and(eq(inboxConnections.tenantId, tenantId), eq(inboxConnections.status, "connected")),
      orderBy: [desc(inboxConnections.createdAt)],
    }),
  ]);

  const { threads, firstMsgByThread, clsByMsg, latestDraftByMsg, loadByNumber } = listData;
  const initialSelectedId = threadId ?? threads[0]?.id ?? null;

  // Fetch initial thread detail for SSR (so first paint has content)
  const initialDetail = initialSelectedId
    ? await fetchThreadDetail(tenantId, initialSelectedId)
    : null;

  return (
    <InboxRoot
      threads={threads}
      firstMsgByThread={firstMsgByThread}
      clsByMsg={clsByMsg}
      latestDraftByMsg={latestDraftByMsg}
      loadByNumber={loadByNumber}
      initialSelectedId={initialSelectedId}
      initialDetail={initialDetail}
      connection={connection ?? null}
      filter={filter}
    />
  );
}
