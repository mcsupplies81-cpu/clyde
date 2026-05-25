"use client";

import { useState } from "react";
import Link from "next/link";
import { resolveThreadAction, escalateThreadAction } from "../actions";
import { useFormStatus } from "react-dom";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "load" | "ai" | "sop" | "docs" | "activity";

type LoadDoc = {
  id: string;
  documentType: string;
  fileName: string;
  fileUrl: string;
};

type Sop = {
  id: string;
  name: string;
  category: string;
  ruleText: string;
  requireApproval: boolean;
};

type Classification = {
  id: string;
  category: string;
  urgency: string | null;
  confidence: string | null;
  extractedLoadNumber: string | null;
  extractedPoNumber: string | null;
  extractedCustomer: string | null;
  extractedCarrier: string | null;
  extractedLane: string | null;
  suggestedAction: string | null;
  reasoning: string | null;
  extractedEntities: Record<string, string | null | undefined> | null;
};

type MatchedLoad = {
  id: string;
  loadNumber: string;
  customerName: string | null;
  carrierName: string | null;
  originCity: string | null;
  originState: string | null;
  destinationCity: string | null;
  destinationState: string | null;
  eta: Date | null;
  driverName: string | null;
  driverPhone: string | null;
  equipmentType: string | null;
  rate: string | null;
  currentStatus: string | null;
  riskLevel: string | null;
};

type TimelineEvent = {
  id: string;
  action: string;
  actorType: string;
  actorName: string;
  entityType: string;
  entityId: string;
  createdAt: Date | null;
  metadata: Record<string, unknown> | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    email_received: "Email received",
    classification_created: "Email classified",
    thread_classified: "Thread classified",
    draft_generated: "Draft generated",
    draft_approved: "Draft approved",
    draft_rejected: "Draft rejected",
    draft_edited: "Draft edited",
    marked_sent_manually: "Marked as sent",
    thread_resolved: "Thread resolved",
    thread_escalated: "Thread escalated",
  };
  return map[action] ?? action.replace(/_/g, " ");
}

function actorDotColor(type: string) {
  return type === "ai" ? "#2563EB" : type === "user" ? "#16A34A" : "#9CA3AF";
}

// ─── Mini submit button ────────────────────────────────────────────────────────

function MiniSubmit({ label, pendingLabel, style }: { label: string; pendingLabel: string; style: React.CSSProperties }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
      style={{ ...style, opacity: pending ? 0.6 : 1, cursor: pending ? "wait" : "pointer" }}>
      {pending ? pendingLabel : label}
    </button>
  );
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string }[] = [
  { key: "load", label: "Load" },
  { key: "ai",   label: "AI" },
  { key: "sop",  label: "SOP" },
  { key: "docs", label: "Docs" },
  { key: "activity", label: "Activity" },
];

// ─── EXPORT ───────────────────────────────────────────────────────────────────

export function RightContextPanel({
  matchedLoad,
  classification,
  appliedSops,
  loadDocs,
  timeline,
  threadId,
  currentStatus,
}: {
  matchedLoad: MatchedLoad | null;
  classification: Classification | null;
  appliedSops: Sop[];
  loadDocs: LoadDoc[];
  timeline: TimelineEvent[];
  threadId: string | null;
  currentStatus: string;
}) {
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    if (matchedLoad) return "load";
    if (classification) return "ai";
    return "activity";
  });

  const tabBtn = (key: Tab): React.CSSProperties => ({
    flex: 1,
    padding: "8px 0",
    fontSize: 11,
    fontWeight: activeTab === key ? 700 : 400,
    color: activeTab === key ? "#2563EB" : "#9CA3AF",
    background: "none",
    border: "none",
    borderBottom: `2px solid ${activeTab === key ? "#2563EB" : "transparent"}`,
    cursor: "pointer",
    transition: "color 0.1s",
    whiteSpace: "nowrap" as const,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Tab bar */}
      <div style={{ display: "flex", borderBottom: "1px solid #E8E8E8", flexShrink: 0, background: "#FFFFFF" }}>
        {TABS.map(({ key, label }) => (
          <button key={key} style={tabBtn(key)} onClick={() => setActiveTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px" }}>

        {/* ── LOAD tab ── */}
        {activeTab === "load" && (
          <div>
            {matchedLoad ? (
              <>
                <div style={{ background: "#FFFFFF", border: "1px solid #E8E8E8", borderRadius: 8, overflow: "hidden", marginBottom: 10 }}>
                  {/* Load header */}
                  <div style={{ padding: "12px 14px", borderBottom: "1px solid #F2F2F2" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 18, fontWeight: 800, color: "#292929", letterSpacing: "-0.5px" }}>
                        {matchedLoad.loadNumber}
                      </span>
                      <RiskPill level={matchedLoad.riskLevel ?? "low"} />
                    </div>
                    <div style={{ fontSize: 11, color: "#7F7F7F", marginBottom: 6 }}>{matchedLoad.customerName}</div>
                    <StatusPill status={matchedLoad.currentStatus ?? "Unknown"} />
                  </div>

                  {/* Route */}
                  <div style={{ padding: "10px 14px", borderBottom: "1px solid #F2F2F2" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase" as const, letterSpacing: "0.6px", marginBottom: 6 }}>
                      Route
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#292929" }}>
                          {matchedLoad.originCity}, {matchedLoad.originState}
                        </div>
                        <div style={{ fontSize: 10, color: "#9CA3AF" }}>Origin</div>
                      </div>
                      <div style={{ flex: 1, height: 1, background: "#E8E8E8", margin: "0 6px" }} />
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                      </svg>
                      <div style={{ flex: 1, height: 1, background: "#E8E8E8", margin: "0 6px" }} />
                      <div style={{ textAlign: "right" as const }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#292929" }}>
                          {matchedLoad.destinationCity}, {matchedLoad.destinationState}
                        </div>
                        <div style={{ fontSize: 10, color: "#9CA3AF" }}>Destination</div>
                      </div>
                    </div>
                  </div>

                  {/* Details */}
                  <div style={{ padding: "10px 14px" }}>
                    {[
                      ["Carrier",    matchedLoad.carrierName],
                      ["Driver",     matchedLoad.driverName],
                      ["Driver Ph.", matchedLoad.driverPhone],
                      ["ETA",        matchedLoad.eta ? new Date(matchedLoad.eta).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null],
                      ["Equipment",  matchedLoad.equipmentType],
                      ["Rate",       matchedLoad.rate ? `$${Number(matchedLoad.rate).toLocaleString()}` : null],
                    ].filter(([, v]) => v).map(([label, val]) => (
                      <div key={label as string} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #F9FAFB", fontSize: 11 }}>
                        <span style={{ color: "#9CA3AF" }}>{label}</span>
                        <span style={{ color: "#292929", fontWeight: 500, textAlign: "right" as const, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{val}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Link
                  href={`/app/loads/${matchedLoad.id}`}
                  style={{ display: "block", textAlign: "center" as const, padding: "7px", background: "#F9FAFB", border: "1px solid #E8E8E8", borderRadius: 6, color: "#5D5D5D", fontSize: 11, textDecoration: "none", fontWeight: 500 }}
                >
                  View Full Load Detail →
                </Link>

                {/* Quick actions */}
                {threadId && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase" as const, letterSpacing: "0.6px", marginBottom: 8 }}>
                      Quick Actions
                    </div>
                    <QuickActions threadId={threadId} currentStatus={currentStatus} />
                  </div>
                )}
              </>
            ) : (
              <EmptyState
                icon="📦"
                title="No load matched"
                body="Classify the email to attempt automatic load matching."
              />
            )}
          </div>
        )}

        {/* ── AI tab ── */}
        {activeTab === "ai" && (
          <div>
            {classification ? (
              <>
                <div style={{ background: "#FFFFFF", border: "1px solid #E8E8E8", borderRadius: 8, padding: "12px 14px", marginBottom: 10 }}>
                  {/* Category */}
                  <div style={{ marginBottom: 10 }}>
                    <CatPill category={classification.category} />
                  </div>

                  {/* Core fields */}
                  {[
                    ["Urgency",    classification.urgency ?? "normal"],
                    ["Confidence", `${Math.round(Number(classification.confidence) * 100)}%`],
                    ...(classification.extractedLoadNumber ? [["Load #", classification.extractedLoadNumber]] : []),
                    ...(classification.extractedPoNumber   ? [["PO #",   classification.extractedPoNumber]]   : []),
                    ...(classification.extractedCustomer   ? [["Customer", classification.extractedCustomer]] : []),
                    ...(classification.extractedCarrier    ? [["Carrier", classification.extractedCarrier]]   : []),
                    ...(classification.extractedLane       ? [["Lane",    classification.extractedLane]]      : []),
                  ].map(([label, val]) => (
                    <div key={label as string} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 11, borderBottom: "1px solid #F9FAFB" }}>
                      <span style={{ color: "#9CA3AF" }}>{label}</span>
                      <span style={{ color: "#292929", fontWeight: 500 }}>{val}</span>
                    </div>
                  ))}

                  {/* Extracted entities */}
                  {classification.extractedEntities && (
                    <>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase" as const, letterSpacing: "0.6px", margin: "10px 0 6px" }}>
                        Extracted Details
                      </div>
                      {(Object.entries(classification.extractedEntities) as [string, string | null | undefined][])
                        .filter(([, v]) => v)
                        .map(([key, val]) => (
                          <div key={key} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 11, borderBottom: "1px solid #F9FAFB" }}>
                            <span style={{ color: "#9CA3AF" }}>
                              {key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
                            </span>
                            <span style={{ color: "#292929", fontWeight: 500, textAlign: "right" as const, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{val}</span>
                          </div>
                        ))}
                    </>
                  )}

                  {/* Suggested action */}
                  {classification.suggestedAction && (
                    <div style={{ marginTop: 10, padding: "8px 10px", background: "#EFF6FF", borderRadius: 6, border: "1px solid #BFDBFE" }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase" as const, letterSpacing: "0.5px", marginBottom: 3 }}>
                        Suggested Action
                      </div>
                      <div style={{ fontSize: 11, color: "#1D4ED8", lineHeight: 1.5 }}>{classification.suggestedAction}</div>
                    </div>
                  )}

                  {/* Reasoning */}
                  {classification.reasoning && (
                    <div style={{ marginTop: 8, fontSize: 10, color: "#9CA3AF", lineHeight: 1.5 }}>{classification.reasoning}</div>
                  )}
                </div>
              </>
            ) : (
              <EmptyState
                icon="🧠"
                title="Not yet classified"
                body="Click 'Classify with AI' on the inbound email to extract freight details."
              />
            )}
          </div>
        )}

        {/* ── SOP tab ── */}
        {activeTab === "sop" && (
          <div>
            {appliedSops.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 4 }}>
                  {appliedSops.length} active rule{appliedSops.length > 1 ? "s" : ""} for this email category
                </div>
                {appliedSops.map((sop) => (
                  <div key={sop.id} style={{ background: "#FFFFFF", border: "1px solid #E8E8E8", borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#292929" }}>{sop.name}</span>
                      {sop.requireApproval && (
                        <span style={{ fontSize: 10, fontWeight: 600, color: "#D97706", background: "#FFFBEB", padding: "1px 6px", borderRadius: 3 }}>
                          Approval req.
                        </span>
                      )}
                    </div>
                    <p style={{ margin: 0, fontSize: 12, color: "#5D5D5D", lineHeight: 1.6 }}>{sop.ruleText}</p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon="📋"
                title="No SOPs applied"
                body={classification ? "No active rules match this email category." : "Classify the email to see applicable rules."}
              />
            )}
          </div>
        )}

        {/* ── DOCS tab ── */}
        {activeTab === "docs" && (
          <div>
            {loadDocs.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 4 }}>
                  {loadDocs.length} document{loadDocs.length > 1 ? "s" : ""} on file for this load
                </div>
                {loadDocs.map((doc) => (
                  <a
                    key={doc.id}
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      background: "#FFFFFF",
                      border: "1px solid #E8E8E8",
                      borderRadius: 7,
                      padding: "9px 12px",
                      textDecoration: "none",
                    }}
                  >
                    <span style={{ fontSize: 16 }}>📄</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#292929" }}>{doc.documentType}</div>
                      <div style={{ fontSize: 10, color: "#9CA3AF" }}>{doc.fileName}</div>
                    </div>
                    <div style={{ marginLeft: "auto", fontSize: 11, color: "#2563EB" }}>↗</div>
                  </a>
                ))}
              </div>
            ) : (
              <EmptyState
                icon="📂"
                title="No documents"
                body={matchedLoad ? "No documents on file for this load." : "Match a load to see its documents."}
              />
            )}
          </div>
        )}

        {/* ── ACTIVITY tab ── */}
        {activeTab === "activity" && (
          <div>
            {timeline.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {timeline.map((event, i) => {
                  const isLast = i === timeline.length - 1;
                  const dotColor = actorDotColor(event.actorType ?? "system");
                  return (
                    <div key={event.id} style={{ display: "flex", gap: 10, paddingBottom: isLast ? 0 : 12, position: "relative" }}>
                      {!isLast && (
                        <div style={{ position: "absolute", left: 6, top: 16, bottom: 0, width: 1, background: "#F2F2F2" }} />
                      )}
                      <div style={{
                        width: 13, height: 13, borderRadius: "50%",
                        background: `${dotColor}18`, border: `2px solid ${dotColor}`,
                        flexShrink: 0, marginTop: 2,
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, color: "#292929", fontWeight: 500 }}>{actionLabel(event.action)}</div>
                        <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 1 }}>
                          {event.actorName} · {relativeTime(event.createdAt)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon="📜"
                title="No activity yet"
                body="Activity events will appear here as you work the thread."
              />
            )}
          </div>
        )}

      </div>
    </div>
  );
}

// ─── Quick actions ─────────────────────────────────────────────────────────────

function QuickActions({ threadId, currentStatus }: { threadId: string; currentStatus: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {currentStatus !== "resolved" && currentStatus !== "sent" && (
        <form action={resolveThreadAction}>
          <input type="hidden" name="threadId" value={threadId} />
          <MiniSubmit
            label="Mark Resolved"
            pendingLabel="Resolving…"
            style={{
              width: "100%", padding: "7px 12px",
              background: "#F0FDF4", border: "1px solid #D1FAE5",
              borderRadius: 6, color: "#16A34A", fontSize: 11, fontWeight: 600, textAlign: "left" as const,
            }}
          />
        </form>
      )}
      {currentStatus !== "escalated" && (
        <form action={escalateThreadAction}>
          <input type="hidden" name="threadId" value={threadId} />
          <MiniSubmit
            label="Escalate to Lead"
            pendingLabel="Escalating…"
            style={{
              width: "100%", padding: "7px 12px",
              background: "#FFF7ED", border: "1px solid #FED7AA",
              borderRadius: 6, color: "#EA580C", fontSize: 11, fontWeight: 600, textAlign: "left" as const,
            }}
          />
        </form>
      )}
    </div>
  );
}

// ─── Pill components ───────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    "In Transit":              { bg: "#EFF6FF", text: "#1D4ED8", label: "In Transit" },
    "Delivered":               { bg: "#F0FDF4", text: "#15803D", label: "Delivered" },
    "Delivered - POD Pending": { bg: "#ECFDF5", text: "#059669", label: "Delivered — POD Pending" },
    "Booked":                  { bg: "#EFF6FF", text: "#2563EB", label: "Booked" },
    "Dispatched":              { bg: "#EFF6FF", text: "#0284C7", label: "Dispatched" },
    "At Pickup":               { bg: "#FFFBEB", text: "#D97706", label: "At Pickup" },
    "Out for Delivery":        { bg: "#ECFDF5", text: "#059669", label: "Out for Delivery" },
    "Delayed":                 { bg: "#FFF7ED", text: "#EA580C", label: "Delayed" },
    "Exception":               { bg: "#FEF2F2", text: "#DC2626", label: "Exception" },
  };
  const c = map[status] ?? { bg: "#F9FAFB", text: "#6B7280", label: status };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 4, background: c.bg, color: c.text, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" as const }}>
      {c.label}
    </span>
  );
}

function RiskPill({ level }: { level: string }) {
  const map: Record<string, { bg: string; text: string; dot: string; label: string }> = {
    low:      { bg: "#F0FDF4", text: "#16A34A", dot: "#22C55E", label: "Low Risk" },
    medium:   { bg: "#FFFBEB", text: "#D97706", dot: "#F59E0B", label: "Med Risk" },
    high:     { bg: "#FFF7ED", text: "#EA580C", dot: "#F97316", label: "High Risk" },
    critical: { bg: "#FEF2F2", text: "#DC2626", dot: "#EF4444", label: "Critical" },
  };
  const c = map[level] ?? map.low;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 4, background: c.bg, color: c.text, fontSize: 10, fontWeight: 600 }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: c.dot }} />
      {c.label}
    </span>
  );
}

function CatPill({ category }: { category: string }) {
  const map: Record<string, { color: string; bg: string; label: string }> = {
    status_request:        { color: "#1D4ED8", bg: "#EFF6FF", label: "Status Update" },
    quote_request:         { color: "#7C3AED", bg: "#F5F3FF", label: "Quote Request" },
    pod_request:           { color: "#059669", bg: "#ECFDF5", label: "POD Request" },
    bol_request:           { color: "#0D9488", bg: "#F0FDFA", label: "BOL Request" },
    rate_confirmation:     { color: "#2563EB", bg: "#EFF6FF", label: "Rate Con" },
    carrier_update:        { color: "#0284C7", bg: "#F0F9FF", label: "Carrier Update" },
    appointment_change:    { color: "#D97706", bg: "#FFFBEB", label: "Appointment" },
    detention_accessorial: { color: "#EA580C", bg: "#FFF7ED", label: "Detention" },
    billing_invoice:       { color: "#7C3AED", bg: "#F5F3FF", label: "Billing" },
    escalation:            { color: "#DC2626", bg: "#FEF2F2", label: "Escalation" },
    unknown:               { color: "#6B7280", bg: "#F9FAFB", label: "Unclassified" },
  };
  const c = map[category] ?? { color: "#6B7280", bg: "#F9FAFB", label: category.replace(/_/g, " ") };
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color: c.color, background: c.bg, padding: "2px 8px", borderRadius: 4, whiteSpace: "nowrap" as const }}>
      {c.label}
    </span>
  );
}

// ─── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div style={{ padding: "32px 0", textAlign: "center" as const }}>
      <div style={{ fontSize: 24, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#5D5D5D", marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12, color: "#9CA3AF", lineHeight: 1.5 }}>{body}</div>
    </div>
  );
}
