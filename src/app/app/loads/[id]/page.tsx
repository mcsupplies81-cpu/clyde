import { getTenantIdForUser } from "@/lib/auth";
import Link from "next/link";
import { db } from "@/db";
import { auditLogs, emailMessages, emailThreads, loadDocuments, loads, aiClassifications, chaseFollowUps } from "@/db/schema";
import { StatusBadge } from "@/components/StatusBadge";
import { RiskBadge } from "@/components/RiskBadge";
import { CategoryBadge } from "@/components/CategoryBadge";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { fmtDate, fmtDateTime, fmtCurrency, etaLabel, statusProgress } from "@/lib/format";
import { actionLabel } from "@/lib/workflow";
import { ChaseDocumentButton } from "./ChaseDocumentButton";
import { ChaseAllDocsButton } from "./ChaseAllDocsButton";

const REQUIRED_DOCS = ["BOL", "POD", "Rate Confirmation", "Invoice", "Lumper Receipt"];
const STATUS_OPTIONS = ["Booked", "Dispatched", "At Pickup", "In Transit", "Out for Delivery", "Delivered", "Exception"];

export default async function LoadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenantId = await getTenantIdForUser();

  if (!tenantId) return <div style={{ padding: 40, color: "#DC2626" }}>Not authenticated.</div>;

  const load = await db.query.loads.findFirst({
    where: and(eq(loads.id, id), eq(loads.tenantId, tenantId)),
  });

  if (!load) {
    return (
      <div style={{ padding: 24, background: "#FAFAF8", minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 12, color: "#E8E8E8" }}>◫</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#5D5D5D", marginBottom: 8 }}>Load not found</div>
          <Link href="/app/loads" style={{ color: "#2563EB", fontSize: 12, textDecoration: "none" }}>← Back to loads</Link>
        </div>
      </div>
    );
  }

  // Find thread IDs that mention this load number via AI classifications
  const clsForLoad = load.loadNumber
    ? await db
        .select({ messageId: aiClassifications.messageId })
        .from(aiClassifications)
        .where(and(eq(aiClassifications.tenantId, tenantId), eq(aiClassifications.extractedLoadNumber, load.loadNumber)))
    : [];
  const msgIdsForLoad = clsForLoad.map((c) => c.messageId);
  const threadIdsFromCls = msgIdsForLoad.length
    ? await db
        .select({ threadId: emailMessages.threadId })
        .from(emailMessages)
        .where(inArray(emailMessages.id, msgIdsForLoad))
    : [];
  const clsThreadIds = [...new Set(threadIdsFromCls.map((r) => r.threadId))];

  // Fetch all related data in parallel
  const [docs, relatedThreadsRaw, loadAuditLogs, activeFollowUpsRaw] = await Promise.all([
    db.query.loadDocuments.findMany({
      where: and(eq(loadDocuments.loadId, load.id), eq(loadDocuments.tenantId, tenantId)),
      orderBy: [desc(loadDocuments.createdAt)],
    }),
    // Match threads by: load number extracted from emails OR customer name
    db.query.emailThreads.findMany({
      where: and(
        eq(emailThreads.tenantId, tenantId),
        clsThreadIds.length || load.customerName
          ? or(
              clsThreadIds.length ? inArray(emailThreads.id, clsThreadIds) : undefined,
              load.customerName ? eq(emailThreads.customerName, load.customerName) : undefined,
            )
          : eq(emailThreads.tenantId, tenantId), // fallback: no filter (returns nothing useful but won't error)
      ),
      orderBy: [desc(emailThreads.lastMessageAt)],
      limit: 12,
    }),
    db.select().from(auditLogs)
      .where(and(eq(auditLogs.tenantId, tenantId), eq(auditLogs.entityId, load.id)))
      .orderBy(desc(auditLogs.createdAt))
      .limit(30),
    db.query.chaseFollowUps.findMany({
      where: and(eq(chaseFollowUps.loadId, load.id), eq(chaseFollowUps.tenantId, tenantId)),
    }),
  ]);

  // Build last-chased-date per doc type from audit logs
  const lastChaseByDoc: Record<string, Date> = {};
  for (const log of loadAuditLogs) {
    if (!["document_chased", "documents_chased"].includes(log.action)) continue;
    const meta = log.metadata as { docType?: string; docTypes?: string[] } | null;
    const types = meta?.docType ? [meta.docType] : (meta?.docTypes ?? []);
    for (const dt of types) {
      const logDate = new Date(log.createdAt);
      if (!lastChaseByDoc[dt] || logDate > lastChaseByDoc[dt]) lastChaseByDoc[dt] = logDate;
    }
  }

  // Build active follow-up per doc type
  const activeFollowUpByDoc: Record<string, typeof activeFollowUpsRaw[0]> = {};
  for (const fu of activeFollowUpsRaw) {
    if (fu.status !== "active") continue;
    for (const dt of fu.docTypes.split(",").map((d) => d.trim())) {
      if (!activeFollowUpByDoc[dt]) activeFollowUpByDoc[dt] = fu;
    }
  }

  // Fetch thread classifications
  const relatedThreadIds = relatedThreadsRaw.map((t) => t.id);
  const threadMsgs = relatedThreadIds.length
    ? await db.select().from(emailMessages)
        .where(and(eq(emailMessages.tenantId, tenantId), inArray(emailMessages.threadId, relatedThreadIds), eq(emailMessages.direction, "inbound")))
    : [];
  const firstMsgByThread: Record<string, typeof threadMsgs[0]> = {};
  for (const m of threadMsgs) {
    if (!firstMsgByThread[m.threadId]) firstMsgByThread[m.threadId] = m;
  }
  const firstMsgIds = Object.values(firstMsgByThread).map((m) => m.id);
  const threadCls = firstMsgIds.length
    ? await db.select().from(aiClassifications).where(inArray(aiClassifications.messageId, firstMsgIds))
    : [];
  const clsByMsg: Record<string, typeof threadCls[0]> = {};
  for (const c of threadCls) clsByMsg[c.messageId] = c;

  // Thread-level audit logs for timeline
  const threadAuditLogs = relatedThreadIds.length
    ? await db.select().from(auditLogs)
        .where(and(eq(auditLogs.tenantId, tenantId), inArray(auditLogs.entityId, relatedThreadIds)))
        .orderBy(desc(auditLogs.createdAt))
        .limit(20)
    : [];

  // Synthesize email received events
  const emailReceivedEvents = threadMsgs
    .filter((m) => m.direction === "inbound")
    .map((m) => ({
      id: `msg_${m.id}`,
      action: "email_received",
      actorType: "system" as const,
      actorName: m.senderName ?? m.senderEmail,
      entityType: "email_message",
      createdAt: m.receivedAt ?? m.createdAt,
    }));

  const allTimelineEvents = [
    ...loadAuditLogs,
    ...threadAuditLogs,
    ...emailReceivedEvents,
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 25);

  const missingDocs = REQUIRED_DOCS.filter(
    (dt) => !docs.some((d) => d.documentType.toLowerCase().includes(dt.toLowerCase())),
  );

  // Try to find carrier email from related thread inbound messages
  // Heuristic: prefer senders whose email domain differs from customer email pattern,
  // or just use the most recent inbound sender from carrier-named threads
  const carrierThread = relatedThreadsRaw.find((t) => t.carrierName === load.carrierName);
  const carrierMsg = carrierThread
    ? threadMsgs.find((m) => m.threadId === carrierThread.id && m.direction === "inbound")
    : null;
  const carrierEmail = carrierMsg?.senderEmail ?? null;

  const eta      = etaLabel(load.eta);
  const progress = statusProgress(load.currentStatus);

  async function updateStatusAction(fd: FormData) {
    "use server";
    const newStatus = String(fd.get("status") ?? "").trim();
    if (!newStatus || !tenantId) return;
    await db.update(loads).set({ currentStatus: newStatus }).where(and(eq(loads.id, id), eq(loads.tenantId, tenantId)));
    const { auditLogs: auditLogsTable } = await import("@/db/schema");
    await db.insert(auditLogsTable).values({
      tenantId, actorType: "user", actorName: "Ops Team",
      entityType: "load", entityId: id,
      action: "status_updated", metadata: { newStatus },
    });
    revalidatePath(`/app/loads/${id}`);
  }

  const actorDot = (type: string) =>
    type === "ai" ? "#2563EB" : type === "user" ? "#16A34A" : "#9CA3AF";

  return (
    <div style={{ background: "#FAFAF8", minHeight: "100%", padding: "20px 24px" }}>

      {/* Back */}
      <div style={{ marginBottom: 14 }}>
        <Link href="/app/loads" style={{ color: "#9CA3AF", fontSize: 11, textDecoration: "none", fontWeight: 500 }}>
          ← Load Board
        </Link>
      </div>

      {/* BOL chase banner — show when BOL missing and load is at pickup / in transit */}
      {missingDocs.includes("BOL") && ["At Pickup", "Dispatched", "In Transit"].some(
        (s) => load.currentStatus?.toLowerCase().includes(s.toLowerCase())
      ) && (
        <div style={{
          marginBottom: 10,
          background: "#EFF6FF",
          border: "1px solid #BFDBFE",
          borderLeft: "3px solid #2563EB",
          borderRadius: "0 8px 8px 0",
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#1D4ED8" }}>📄 BOL Missing</div>
            <div style={{ fontSize: 11, color: "#3B82F6", marginTop: 2 }}>
              Load is {load.currentStatus}. BOL should be on file before delivery.
            </div>
          </div>
          <ChaseDocumentButton
            loadId={load.id}
            loadNumber={load.loadNumber}
            docType="BOL"
            carrierName={load.carrierName}
            defaultCarrierEmail={carrierEmail}
            lastChasedAt={lastChaseByDoc["BOL"]?.toISOString() ?? null}
            activeFollowUp={activeFollowUpByDoc["BOL"] ? {
              id: activeFollowUpByDoc["BOL"].id,
              sendCount: activeFollowUpByDoc["BOL"].sendCount,
              maxSends: activeFollowUpByDoc["BOL"].maxSends,
              nextSendAt: new Date(activeFollowUpByDoc["BOL"].nextSendAt).toISOString(),
              messageTemplate: activeFollowUpByDoc["BOL"].messageTemplate,
            } : null}
          />
        </div>
      )}

      {/* POD chase banner — show when POD missing and load is active/delivered */}
      {missingDocs.includes("POD") && ["In Transit", "Delivered", "Out for Delivery"].some(
        (s) => load.currentStatus?.toLowerCase().includes(s.toLowerCase())
      ) && (
        <div style={{
          marginBottom: 14,
          background: "#FFFBEB",
          border: "1px solid #FDE68A",
          borderLeft: "3px solid #F59E0B",
          borderRadius: "0 8px 8px 0",
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#92400E" }}>⚠ POD Missing</div>
            <div style={{ fontSize: 11, color: "#B45309", marginTop: 2 }}>
              Load is {load.currentStatus}. Chase carrier for proof of delivery to unblock billing.
            </div>
          </div>
          <ChaseDocumentButton
            loadId={load.id}
            loadNumber={load.loadNumber}
            docType="POD"
            carrierName={load.carrierName}
            defaultCarrierEmail={carrierEmail}
            lastChasedAt={lastChaseByDoc["POD"]?.toISOString() ?? null}
            activeFollowUp={activeFollowUpByDoc["POD"] ? {
              id: activeFollowUpByDoc["POD"].id,
              sendCount: activeFollowUpByDoc["POD"].sendCount,
              maxSends: activeFollowUpByDoc["POD"].maxSends,
              nextSendAt: new Date(activeFollowUpByDoc["POD"].nextSendAt).toISOString(),
              messageTemplate: activeFollowUpByDoc["POD"].messageTemplate,
            } : null}
          />
        </div>
      )}

      {/* Hero */}
      <div style={{ background: "#FFFFFF", border: "1px solid #E8E8E8", borderRadius: 10, padding: "18px 22px", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14, marginBottom: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: "#292929", letterSpacing: "-1px", fontFamily: "monospace" }}>
                {load.loadNumber}
              </h1>
              <StatusBadge status={load.currentStatus ?? "Unknown"} />
              <RiskBadge level={load.riskLevel ?? "low"} />
            </div>
            <div style={{ display: "flex", gap: 14, color: "#9CA3AF", fontSize: 12 }}>
              {load.customerName && (
                <span>Customer: <span style={{ color: "#5D5D5D" }}>{load.customerName}</span></span>
              )}
              {load.carrierName && (
                <span>Carrier: <span style={{ color: "#5D5D5D" }}>{load.carrierName}</span></span>
              )}
              {load.poNumber && (
                <span>PO: <span style={{ color: "#5D5D5D", fontFamily: "monospace" }}>{load.poNumber}</span></span>
              )}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: eta.color, letterSpacing: "-0.5px" }}>
              {eta.text}
            </div>
            {load.rate && (
              <div style={{ fontSize: 14, fontWeight: 600, color: "#7F7F7F", marginTop: 4 }}>
                {fmtCurrency(load.rate)}
              </div>
            )}
          </div>
        </div>

        {/* Progress */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
            <span style={{ fontSize: 10, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.5px" }}>Shipment Progress</span>
            <span style={{ fontSize: 10, color: "#9CA3AF" }}>{progress}%</span>
          </div>
          <div style={{ height: 6, background: "#F2F2F2", borderRadius: 3, overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${progress}%`,
              background: progress === 100 ? "#16A34A" : load.currentStatus?.toLowerCase() === "exception" ? "#EF4444" : "#2563EB",
              borderRadius: 3,
              transition: "width 0.4s ease",
            }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 9, color: "#9CA3AF", textTransform: "uppercase" }}>
            <span>Booked</span>
            <span>In Transit</span>
            <span>Delivered</span>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 308px", gap: 18, alignItems: "start" }}>

        {/* ── Left column ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Route & timing */}
          <section style={{ background: "#FFFFFF", border: "1px solid #E8E8E8", borderRadius: 10, padding: 18 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 14 }}>
              Route & Timing
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 40px 1fr", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ background: "#FAFAF8", borderRadius: 8, padding: "10px 12px", border: "1px solid #F2F2F2" }}>
                <div style={{ fontSize: 9, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Origin</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#292929" }}>{load.originCity}, {load.originState}</div>
                <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 3 }}>Pickup: {fmtDate(load.pickupAt)}</div>
              </div>
              <div style={{ textAlign: "center", color: "#E8E8E8", fontSize: 16 }}>→</div>
              <div style={{ background: "#FAFAF8", borderRadius: 8, padding: "10px 12px", border: "1px solid #F2F2F2" }}>
                <div style={{ fontSize: 9, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Destination</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#292929" }}>{load.destinationCity}, {load.destinationState}</div>
                <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 3 }}>Delivery: {fmtDate(load.deliveryAt)}</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
              {[
                { label: "Driver",    value: load.driverName },
                { label: "Phone",     value: load.driverPhone },
                { label: "Equipment", value: load.equipmentType },
                { label: "ETA",       value: fmtDateTime(load.eta) },
              ].map(({ label, value }) => value && (
                <div key={label} style={{ padding: "8px 10px", background: "#FAFAF8", borderRadius: 6, border: "1px solid #F2F2F2" }}>
                  <div style={{ fontSize: 9, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 12, color: "#5D5D5D" }}>{value}</div>
                </div>
              ))}
            </div>
            {load.internalNotes && (
              <div style={{ marginTop: 12, padding: "10px 12px", background: "#FAFAF8", borderRadius: 6, borderLeft: "2px solid #2563EB" }}>
                <div style={{ fontSize: 9, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Internal Notes</div>
                <div style={{ fontSize: 12, color: "#5D5D5D", lineHeight: 1.6 }}>{load.internalNotes}</div>
              </div>
            )}
          </section>

          {/* Documents */}
          <section style={{ background: "#FFFFFF", border: "1px solid #E8E8E8", borderRadius: 10, padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "1px" }}>
                Documents
              </div>
              {missingDocs.length > 0 && (
                <span style={{ fontSize: 11, color: "#EA580C", background: "#FFF7ED", padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>
                  {missingDocs.length} missing
                </span>
              )}
            </div>

            {docs.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                {docs.map((d) => (
                  <div
                    key={d.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      background: "#FAFAF8",
                      borderRadius: 6,
                      padding: "8px 12px",
                      border: "1px solid #F2F2F2",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: "#292929" }}>{d.documentType}</div>
                      <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 2 }}>{d.fileName}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 10, color: "#16A34A", background: "#F0FDF4", border: "1px solid #D1FAE5", padding: "1px 7px", borderRadius: 3, fontWeight: 600 }}>
                        Available
                      </span>
                      <a href={d.fileUrl} style={{ fontSize: 11, color: "#2563EB", textDecoration: "none" }}>↓</a>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {missingDocs.length > 0 && (
              <div>
                <div style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 8 }}>Missing documents:</div>

                {/* Chase all in one email — shown when 2+ docs missing */}
                {missingDocs.length >= 2 && (
                  <div style={{ marginBottom: 10 }}>
                    <ChaseAllDocsButton
                      loadId={load.id}
                      loadNumber={load.loadNumber}
                      missingDocs={missingDocs}
                      carrierName={load.carrierName}
                      defaultCarrierEmail={carrierEmail}
                    />
                  </div>
                )}

                {/* Individual chase per doc */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {missingDocs.length >= 2 && (
                    <div style={{ fontSize: 10, color: "#C4C4C4", marginBottom: 2 }}>or chase individually:</div>
                  )}
                  {missingDocs.map((dt) => (
                    <div key={dt}>
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                        padding: "7px 10px",
                        background: lastChaseByDoc[dt] ? "#FFFBEB" : "#FFF7ED",
                        border: `1px solid ${lastChaseByDoc[dt] ? "#FDE68A" : "#FED7AA"}`,
                        borderRadius: 5,
                        flexWrap: "wrap",
                      }}>
                        <div>
                          <span style={{ fontSize: 11, color: "#EA580C", fontWeight: 600 }}>
                            ⚠ Missing: {dt}
                          </span>
                          {lastChaseByDoc[dt] && (
                            <span style={{ fontSize: 10, color: "#9CA3AF", marginLeft: 8 }}>
                              Last chased {Math.round((Date.now() - new Date(lastChaseByDoc[dt]).getTime()) / 86400000)}d ago
                            </span>
                          )}
                        </div>
                        <ChaseDocumentButton
                          loadId={load.id}
                          loadNumber={load.loadNumber}
                          docType={dt}
                          carrierName={load.carrierName}
                          defaultCarrierEmail={carrierEmail}
                          lastChasedAt={lastChaseByDoc[dt]?.toISOString() ?? null}
                          activeFollowUp={activeFollowUpByDoc[dt] ? {
                            id: activeFollowUpByDoc[dt].id,
                            sendCount: activeFollowUpByDoc[dt].sendCount,
                            maxSends: activeFollowUpByDoc[dt].maxSends,
                            nextSendAt: new Date(activeFollowUpByDoc[dt].nextSendAt).toISOString(),
                            messageTemplate: activeFollowUpByDoc[dt].messageTemplate,
                          } : null}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {docs.length === 0 && missingDocs.length === 0 && (
              <div style={{ color: "#9CA3AF", fontSize: 12 }}>No documents on file.</div>
            )}
          </section>

          {/* Related threads */}
          <section style={{ background: "#FFFFFF", border: "1px solid #E8E8E8", borderRadius: 10, padding: 18 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 14 }}>
              Related Communication
            </div>
            {relatedThreadsRaw.length === 0 ? (
              <div style={{ color: "#9CA3AF", fontSize: 12 }}>No email threads tied to this customer.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {relatedThreadsRaw.map((t) => {
                  const firstMsg = firstMsgByThread[t.id];
                  const cls = firstMsg ? clsByMsg[firstMsg.id] : undefined;
                  return (
                    <Link
                      key={t.id}
                      href={`/app/inbox?threadId=${t.id}`}
                      style={{
                        display: "block",
                        background: "#FAFAF8",
                        borderRadius: 6,
                        padding: "10px 12px",
                        textDecoration: "none",
                        border: "1px solid #F2F2F2",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", marginBottom: 6 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: "#292929", lineHeight: 1.35, flex: 1 }}>{t.subject}</div>
                        <StatusBadge status={t.status} />
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        {cls && <CategoryBadge category={cls.category} />}
                        <span style={{ fontSize: 10, color: "#9CA3AF" }}>
                          {t.lastMessageAt ? new Date(t.lastMessageAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* ── Right column ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Update status */}
          <section style={{ background: "#FFFFFF", border: "1px solid #E8E8E8", borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 10 }}>
              Update Status
            </div>
            <form action={updateStatusAction}>
              <select
                name="status"
                defaultValue={load.currentStatus ?? ""}
                style={{
                  width: "100%",
                  background: "#FAFAF8",
                  border: "1px solid #E8E8E8",
                  color: "#292929",
                  borderRadius: 6,
                  padding: "7px 10px",
                  fontSize: 12,
                  marginBottom: 8,
                  outline: "none",
                }}
              >
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button
                type="submit"
                style={{
                  width: "100%",
                  padding: "7px",
                  background: "#2563EB",
                  border: "none",
                  borderRadius: 6,
                  color: "#FFFFFF",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Save Status
              </button>
            </form>
          </section>

          {/* Load summary */}
          <section style={{ background: "#FFFFFF", border: "1px solid #E8E8E8", borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 10 }}>
              Load Summary
            </div>
            {[
              ["Load #",    load.loadNumber],
              ["PO #",      load.poNumber],
              ["Rate",      fmtCurrency(load.rate)],
              ["Equipment", load.equipmentType],
              ["Pickup",    fmtDate(load.pickupAt)],
              ["Delivery",  fmtDate(load.deliveryAt)],
              ["ETA",       fmtDateTime(load.eta)],
            ].filter(([, v]) => v && v !== "—").map(([label, value]) => (
              <div key={label as string} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #F9FAFB", fontSize: 11 }}>
                <span style={{ color: "#9CA3AF" }}>{label}</span>
                <span style={{ color: "#292929", textAlign: "right", maxWidth: 160, fontFamily: label === "Load #" || label === "PO #" ? "monospace" : "inherit" }}>
                  {value}
                </span>
              </div>
            ))}
          </section>

          {/* Activity timeline */}
          {allTimelineEvents.length > 0 && (
            <section style={{ background: "#FFFFFF", border: "1px solid #E8E8E8", borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 14 }}>
                Activity Timeline
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {allTimelineEvents.map((event, i) => {
                  const isLast = i === allTimelineEvents.length - 1;
                  const type = "actorType" in event ? event.actorType : "system";
                  const name = "actorName" in event ? event.actorName : "";
                  const dot  = actorDot(type ?? "system");
                  const label = actionLabel(event.action);
                  return (
                    <div key={event.id} style={{ display: "flex", gap: 9, paddingBottom: isLast ? 0 : 12, position: "relative" }}>
                      {!isLast && (
                        <div style={{ position: "absolute", left: 6, top: 14, bottom: 0, width: 1, background: "#F2F2F2" }} />
                      )}
                      <div style={{
                        width: 13, height: 13, borderRadius: "50%",
                        background: `${dot}18`, border: `2px solid ${dot}`,
                        flexShrink: 0, marginTop: 2,
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, color: "#5D5D5D", fontWeight: 500 }}>{label}</div>
                        <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 2 }}>
                          {name} · {new Date(event.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
