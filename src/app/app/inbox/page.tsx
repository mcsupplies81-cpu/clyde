import { db } from "@/db";
import { emailThreads, emailMessages, loads, aiClassifications, aiDrafts, auditLogs } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { StatusBadge } from "@/components/StatusBadge";
import { CategoryBadge } from "@/components/CategoryBadge";
import { RiskBadge } from "@/components/RiskBadge";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { ClassifyForm, DraftActions, GenerateDraftForm } from "./InboxActions";

async function getInboxData(tenantId: string, threadId?: string) {
  const threads = await db.query.emailThreads.findMany({
    where: eq(emailThreads.tenantId, tenantId),
    orderBy: [desc(emailThreads.lastMessageAt)],
    limit: 50,
  });

  const selectedId = threadId ?? threads[0]?.id;
  if (!selectedId) return { threads, selectedThread: null, messages: [], classification: null, matchedLoad: null, draft: null };

  const selectedThread = threads.find((t) => t.id === selectedId) ?? null;

  const messages = await db.query.emailMessages.findMany({
    where: eq(emailMessages.threadId, selectedId),
    orderBy: [desc(emailMessages.receivedAt)],
  });

  const firstInbound = messages.find((m) => m.direction === "inbound");
  const classification = firstInbound
    ? await db.query.aiClassifications.findFirst({ where: eq(aiClassifications.messageId, firstInbound.id) })
    : null;

  const matchedLoad = classification?.extractedLoadNumber
    ? await db.query.loads.findFirst({ where: eq(loads.loadNumber, classification.extractedLoadNumber) })
    : null;

  const draft = firstInbound
    ? await db.query.aiDrafts.findFirst({ where: eq(aiDrafts.messageId, firstInbound.id) })
    : null;

  return { threads, selectedThread, messages, classification, matchedLoad, draft };
}

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ threadId?: string }> }) {
  const { threadId } = await searchParams;
  const tenantId = process.env.DEMO_TENANT_ID ?? "";

  if (!tenantId) {
    return (
      <div style={{ padding: 40, color: "#f87171" }}>
        <strong>DEMO_TENANT_ID not set.</strong> Run <code>npm run db:seed</code> and add the tenant ID to <code>.env.local</code>.
      </div>
    );
  }

  const { threads, selectedThread, messages, classification, matchedLoad, draft } = await getInboxData(tenantId, threadId);
  const firstInbound = messages.find((m) => m.direction === "inbound");

  async function classifyMessageAction(formData: FormData) {
    "use server";
    const h = await headers();
    const proto = h.get("x-forwarded-proto") ?? "http";
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (!host) throw new Error("Host header missing");
    await fetch(`${proto}://${host}/api/ai/classify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messageId: String(formData.get("messageId") ?? ""),
        subject: String(formData.get("subject") ?? ""),
        body: String(formData.get("body") ?? ""),
        senderName: String(formData.get("senderName") ?? ""),
        senderEmail: String(formData.get("senderEmail") ?? ""),
      }),
    });
    revalidatePath("/app/inbox");
  }

  async function generateDraftAction(formData: FormData) {
    "use server";
    const h = await headers();
    const proto = h.get("x-forwarded-proto") ?? "http";
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (!host) throw new Error("Host header missing");
    await fetch(`${proto}://${host}/api/ai/draft-reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messageId: String(formData.get("messageId") ?? ""),
        classificationId: formData.get("classificationId") ? String(formData.get("classificationId")) : undefined,
        loadId: formData.get("loadId") ? String(formData.get("loadId")) : undefined,
      }),
    });
    revalidatePath("/app/inbox");
  }

  async function updateDraftStatusAction(status: "approved" | "rejected" | "edited", draftBody?: string) {
    "use server";
    if (!draft) return;
    await db.update(aiDrafts).set({ status, draftBody: draftBody ?? draft.draftBody, updatedAt: new Date() }).where(eq(aiDrafts.id, draft.id));
    await db.insert(auditLogs).values({
      tenantId,
      actorType: "user",
      actorName: "Inbox User",
      entityType: "ai_draft",
      entityId: draft.id,
      action: `draft_${status}`,
      metadata: { draftId: draft.id, messageId: draft.messageId },
    });
    revalidatePath("/app/inbox");
  }

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* Left — thread list */}
      <div style={{ width: 280, minWidth: 280, borderRight: "1px solid #1e2d3d", overflow: "auto" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #1e2d3d", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#7f92a8", textTransform: "uppercase", letterSpacing: "0.5px" }}>Inbox</span>
          <span style={{ fontSize: 11, color: "#4a5e75" }}>{threads.length} threads</span>
        </div>
        {threads.map((t) => (
          <a key={t.id} href={`/app/inbox?threadId=${t.id}`} style={{ display: "block", padding: "12px 16px", borderBottom: "1px solid #141c24", background: t.id === selectedThread?.id ? "#1a2535" : "transparent", textDecoration: "none", borderLeft: t.id === selectedThread?.id ? "2px solid #3b82f6" : "2px solid transparent" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#d6e0eb", lineHeight: 1.3, flex: 1, marginRight: 8, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{t.subject}</span>
              <StatusBadge status={t.status} />
            </div>
            <div style={{ fontSize: 11, color: "#7f92a8" }}>{t.customerName ?? t.carrierName ?? "Unknown"}</div>
            <div style={{ marginTop: 6 }}>
              <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 3, background: t.priority === "urgent" ? "#450a0a" : t.priority === "high" ? "#2d1a0a" : "#1a2535", color: t.priority === "urgent" ? "#f87171" : t.priority === "high" ? "#fb923c" : "#7f92a8", fontWeight: 500 }}>
                {t.priority}
              </span>
            </div>
          </a>
        ))}
      </div>

      {/* Center — email thread */}
      <div style={{ flex: 1, overflow: "auto", padding: 24, minWidth: 0 }}>
        {selectedThread ? (
          <>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#d6e0eb" }}>{selectedThread.subject}</h2>
              <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <StatusBadge status={selectedThread.status} />
                {classification && <CategoryBadge category={classification.category} />}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {messages.map((msg) => (
                <div key={msg.id} style={{ background: msg.direction === "inbound" ? "#141c24" : "#0f1e0f", border: `1px solid ${msg.direction === "inbound" ? "#1e2d3d" : "#1a3020"}`, borderRadius: 8, padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                    <div>
                      <span style={{ fontWeight: 600, color: "#d6e0eb", fontSize: 13 }}>{msg.senderName ?? msg.senderEmail}</span>
                      <span style={{ color: "#4a5e75", fontSize: 12, marginLeft: 8 }}>&lt;{msg.senderEmail}&gt;</span>
                    </div>
                    <span style={{ fontSize: 11, color: "#4a5e75" }}>{msg.receivedAt ? new Date(msg.receivedAt).toLocaleString() : ""}</span>
                  </div>
                  <p style={{ margin: 0, color: "#a8bdd4", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{msg.body}</p>
                  <div style={{ marginTop: 8, fontSize: 11, color: msg.direction === "inbound" ? "#60a5fa" : "#4ade80", fontWeight: 500 }}>
                    {msg.direction === "inbound" ? "↓ Inbound" : "↑ Outbound"}
                  </div>
                  {msg.direction === "inbound" ? <ClassifyForm action={classifyMessageAction} message={msg} /> : null}
                </div>
              ))}
            </div>
            {draft && (
              <div style={{ marginTop: 20, background: "#1a2d1a", border: "1px solid #2d4a2d", borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#4ade80", marginBottom: 10 }}>AI Draft — Pending Approval</div>
                <p style={{ margin: "0 0 12px", color: "#a8bdd4", fontSize: 13, whiteSpace: "pre-wrap" }}>{draft.draftBody}</p>
                <DraftActions
                  approveAction={async () => {
                    "use server";
                    await updateDraftStatusAction("approved");
                  }}
                  rejectAction={async () => {
                    "use server";
                    await updateDraftStatusAction("rejected");
                  }}
                  editAction={async (formData) => {
                    "use server";
                    await updateDraftStatusAction("edited", String(formData.get("draftBody") ?? ""));
                  }}
                />
              </div>
            )}
          </>
        ) : (
          <div style={{ color: "#4a5e75", paddingTop: 60, textAlign: "center" }}>Select a thread to view</div>
        )}
      </div>

      {/* Right — load context */}
      <div style={{ width: 300, minWidth: 300, borderLeft: "1px solid #1e2d3d", overflow: "auto", padding: 16 }}>
        {matchedLoad ? (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#7f92a8", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>Matched Load Context</div>
            <div style={{ background: "#141c24", border: "1px solid #1e2d3d", borderRadius: 8, padding: 14, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: "#d6e0eb" }}>{matchedLoad.loadNumber}</span>
                <RiskBadge level={matchedLoad.riskLevel ?? "low"} />
              </div>
              <div style={{ fontSize: 12, color: "#7f92a8", marginBottom: 4 }}>{matchedLoad.customerName}</div>
              <StatusBadge status={matchedLoad.currentStatus ?? "Unknown"} />
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                {[
                  ["Origin", `${matchedLoad.originCity}, ${matchedLoad.originState}`],
                  ["Destination", `${matchedLoad.destinationCity}, ${matchedLoad.destinationState}`],
                  ["Carrier", matchedLoad.carrierName],
                  ["Driver", matchedLoad.driverName],
                  ["Driver Ph", matchedLoad.driverPhone],
                  ["ETA", matchedLoad.eta ? new Date(matchedLoad.eta).toLocaleDateString() : "TBD"],
                  ["Equipment", matchedLoad.equipmentType],
                ].map(([label, val]) => val && (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: "#4a5e75" }}>{label}</span>
                    <span style={{ color: "#a8bdd4", textAlign: "right", maxWidth: 160 }}>{val}</span>
                  </div>
                ))}
              </div>
              {matchedLoad.internalNotes && (
                <div style={{ marginTop: 12, padding: 8, background: "#1f2d3d", borderRadius: 4, fontSize: 12, color: "#7f92a8" }}>
                  <div style={{ fontWeight: 600, marginBottom: 4, color: "#4a5e75" }}>Internal Notes</div>
                  {matchedLoad.internalNotes}
                </div>
              )}
            </div>
            <a href={`/app/loads/${matchedLoad.id}`} style={{ display: "block", textAlign: "center", padding: "8px 12px", background: "#1a2535", border: "1px solid #253347", borderRadius: 6, color: "#60a5fa", fontSize: 12, textDecoration: "none" }}>View Full Load →</a>
          </>
        ) : (
          <div style={{ color: "#4a5e75", fontSize: 12, paddingTop: 20 }}>No load matched to this thread.</div>
        )}

        {classification && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#7f92a8", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>AI Classification</div>
            <div style={{ background: "#141c24", border: "1px solid #1e2d3d", borderRadius: 8, padding: 14 }}>
              <div style={{ marginBottom: 8 }}><CategoryBadge category={classification.category} /></div>
              {[
                ["Urgency", classification.urgency],
                ["Confidence", `${Math.round(Number(classification.confidence) * 100)}%`],
                ["Suggested Action", classification.suggestedAction],
              ].map(([label, val]) => val && (
                <div key={label as string} style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 10, color: "#4a5e75", marginBottom: 2, textTransform: "uppercase" }}>{label}</div>
                  <div style={{ fontSize: 12, color: "#a8bdd4" }}>{val}</div>
                </div>
              ))}
            </div>
            {!draft && firstInbound ? (
              <GenerateDraftForm
                action={generateDraftAction}
                messageId={firstInbound.id}
                classificationId={classification.id}
                loadId={matchedLoad?.id ?? undefined}
              />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
