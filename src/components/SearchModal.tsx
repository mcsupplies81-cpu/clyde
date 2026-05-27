"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

type ThreadResult = {
  id: string;
  subject: string | null;
  customerName: string | null;
  status: string;
  priority: string | null;
  lastMessageAt: string | null;
};

type LoadResult = {
  id: string;
  loadNumber: string;
  customerName: string | null;
  carrierName: string | null;
  originCity: string | null;
  originState: string | null;
  destinationCity: string | null;
  destinationState: string | null;
  currentStatus: string | null;
  riskLevel: string | null;
};

const STATUS_COLOR: Record<string, string> = {
  open: "#D1D5DB",
  pending_review: "#F59E0B",
  drafted: "#60A5FA",
  sent: "#16A34A",
  escalated: "#DC2626",
  resolved: "#6B7280",
};

const RISK_COLOR: Record<string, string> = {
  low: "#16A34A",
  medium: "#D97706",
  high: "#EA580C",
  critical: "#DC2626",
};

function debounce<T extends (...args: Parameters<T>) => void>(fn: T, ms: number) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export function SearchModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [threads, setThreads] = useState<ThreadResult[]>([]);
  const [loads, setLoads] = useState<LoadResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const openModal = useCallback(() => {
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 30);
  }, []);

  const closeModal = useCallback(() => {
    setOpen(false);
    setQuery("");
    setThreads([]);
    setLoads([]);
    setActiveIdx(-1);
  }, []);

  const search = useCallback(
    debounce(async (q: string) => {
      if (q.length < 2) { setThreads([]); setLoads([]); return; }
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setThreads(data.threads ?? []);
        setLoads(data.loads ?? []);
      } catch { /* ignore */ } finally {
        setLoading(false);
      }
    }, 180),
    [],
  );

  useEffect(() => { search(query); }, [query, search]);

  // ⌘K global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); openModal(); }
      if (e.key === "Escape" && open) closeModal();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, openModal, closeModal]);

  // Custom event from sidebar button
  useEffect(() => {
    const handler = () => openModal();
    window.addEventListener("clyde:open-search", handler);
    return () => window.removeEventListener("clyde:open-search", handler);
  }, [openModal]);

  // Click outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (overlayRef.current && e.target === overlayRef.current) closeModal();
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, closeModal]);

  const allResults = [
    ...threads.map((t) => ({ type: "thread" as const, data: t })),
    ...loads.map((l) => ({ type: "load" as const, data: l })),
  ];

  const navigate = (type: "thread" | "load", id: string) => {
    closeModal();
    if (type === "thread") {
      // Fire a custom event so InboxRoot can select the thread instantly (no server round-trip).
      // Falls back to router.push if the inbox isn't mounted (e.g. navigating from another page).
      const dispatched = window.dispatchEvent(new CustomEvent("clyde:select-thread", { detail: { threadId: id } }));
      if (!dispatched || !document.querySelector("[data-inbox-root]")) {
        router.push(`/app/inbox?threadId=${id}`);
      }
    } else {
      router.push(`/app/loads/${id}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, allResults.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && activeIdx >= 0 && allResults[activeIdx]) {
      const r = allResults[activeIdx];
      navigate(r.type, r.data.id);
    }
  };

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(15,20,30,0.45)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: 72,
      }}
    >
      <div style={{
        background: "#FFFFFF",
        borderRadius: 14,
        boxShadow: "0 24px 80px rgba(0,0,0,0.22), 0 4px 16px rgba(0,0,0,0.1)",
        width: "100%",
        maxWidth: 640,
        overflow: "hidden",
        border: "1px solid #E8E8E8",
        margin: "0 20px",
      }}>
        {/* Search input row */}
        <div style={{
          display: "flex", alignItems: "center",
          padding: "16px 18px",
          gap: 12,
          borderBottom: query.length >= 2 ? "1px solid #F2F2F2" : "none",
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIdx(-1); }}
            onKeyDown={handleKeyDown}
            placeholder="Search threads, loads, carriers, load numbers…"
            style={{
              flex: 1, border: "none", outline: "none",
              fontSize: 16, color: "#111827", background: "transparent",
              fontWeight: 400,
            }}
          />
          {loading && (
            <div style={{ width: 16, height: 16, border: "2px solid #E8E8E8", borderTop: "2px solid #2563EB", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
          )}
          <kbd onClick={closeModal} style={{
            fontSize: 11, color: "#9CA3AF", background: "#F5F5F5",
            border: "1px solid #E0E0E0", borderRadius: 5, padding: "3px 8px",
            cursor: "pointer", fontFamily: "inherit",
          }}>
            esc
          </kbd>
        </div>

        {/* Results */}
        {query.length >= 2 && (
          <div style={{ maxHeight: 460, overflowY: "auto" }}>
            {allResults.length === 0 && !loading && (
              <div style={{ padding: "32px 18px", textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>
                No results for &ldquo;{query}&rdquo;
              </div>
            )}

            {threads.length > 0 && (
              <>
                <div style={{ padding: "10px 18px 4px", fontSize: 10, fontWeight: 700, color: "#C4C4C4", textTransform: "uppercase", letterSpacing: "1px" }}>
                  Threads
                </div>
                {threads.map((t, i) => {
                  const isActive = i === activeIdx;
                  return (
                    <button
                      key={t.id}
                      onClick={() => navigate("thread", t.id)}
                      onMouseEnter={() => setActiveIdx(i)}
                      style={{
                        display: "flex", alignItems: "center", gap: 12, width: "100%",
                        padding: "10px 18px", textAlign: "left", border: "none",
                        background: isActive ? "#EFF6FF" : "transparent",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_COLOR[t.status] ?? "#D1D5DB", flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, color: "#111827", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {t.subject ?? "(no subject)"}
                        </div>
                        <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 1 }}>
                          {t.customerName ?? "Unknown"} · {t.status.replace(/_/g, " ")}
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: "#C4C4C4", flexShrink: 0 }}>
                        {t.lastMessageAt ? new Date(t.lastMessageAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
                      </div>
                    </button>
                  );
                })}
              </>
            )}

            {loads.length > 0 && (
              <>
                <div style={{ padding: "10px 18px 4px", fontSize: 10, fontWeight: 700, color: "#C4C4C4", textTransform: "uppercase", letterSpacing: "1px", borderTop: threads.length > 0 ? "1px solid #F5F5F5" : undefined }}>
                  Loads
                </div>
                {loads.map((l, i) => {
                  const idx = threads.length + i;
                  const isActive = idx === activeIdx;
                  return (
                    <button
                      key={l.id}
                      onClick={() => navigate("load", l.id)}
                      onMouseEnter={() => setActiveIdx(idx)}
                      style={{
                        display: "flex", alignItems: "center", gap: 12, width: "100%",
                        padding: "10px 18px", textAlign: "left", border: "none",
                        background: isActive ? "#EFF6FF" : "transparent",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: RISK_COLOR[l.riskLevel ?? "low"] ?? "#D1D5DB", flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, color: "#111827", fontWeight: 600, fontFamily: "monospace" }}>
                          {l.loadNumber}
                          {l.currentStatus && (
                            <span style={{ fontSize: 12, fontWeight: 400, color: "#9CA3AF", marginLeft: 10, fontFamily: "inherit" }}>
                              {l.currentStatus}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {[l.customerName, l.originCity && l.destinationCity ? `${l.originCity}, ${l.originState} → ${l.destinationCity}, ${l.destinationState}` : null].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: "#B0B0B0", flexShrink: 0 }}>{l.carrierName ?? ""}</div>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ padding: "8px 18px", borderTop: "1px solid #F5F5F5", display: "flex", gap: 14, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#C4C4C4" }}>↑↓ navigate</span>
          <span style={{ fontSize: 11, color: "#C4C4C4" }}>↵ open</span>
          <span style={{ fontSize: 11, color: "#C4C4C4" }}>esc close</span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: "#D1D5DB" }}>⌘K</span>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
