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

export function SearchBar() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [threads, setThreads] = useState<ThreadResult[]>([]);
  const [loads, setLoads] = useState<LoadResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(
    debounce(async (q: string) => {
      if (q.length < 2) { setThreads([]); setLoads([]); return; }
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setThreads(data.threads ?? []);
        setLoads(data.loads ?? []);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }, 200),
    [],
  );

  useEffect(() => { search(query); }, [query, search]);

  // ⌘K global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === "Escape") { setOpen(false); setQuery(""); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const allResults = [
    ...threads.map((t) => ({ type: "thread" as const, data: t })),
    ...loads.map((l) => ({ type: "load" as const, data: l })),
  ];

  const hasResults = allResults.length > 0;

  const navigate = (type: "thread" | "load", id: string) => {
    setOpen(false);
    setQuery("");
    if (type === "thread") router.push(`/app/inbox?threadId=${id}`);
    else router.push(`/app/loads/${id}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, allResults.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, -1)); }
    if (e.key === "Enter" && activeIdx >= 0 && allResults[activeIdx]) {
      const r = allResults[activeIdx];
      navigate(r.type, r.data.id);
    }
  };

  return (
    <>
      {/* Trigger bar (always visible) */}
      <div
        style={{ position: "relative", flex: 1, maxWidth: 380 }}
        ref={!open ? containerRef : undefined}
      >
        <svg
          width="13" height="13"
          viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          placeholder="Search threads, loads, carriers…"
          readOnly
          onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
          style={{
            width: "100%",
            background: "#F9FAFB",
            border: "1px solid #E8E8E8",
            borderRadius: 6,
            padding: "6px 12px 6px 30px",
            color: "#292929",
            fontSize: 12,
            outline: "none",
            cursor: "pointer",
          }}
        />
        <span style={{
          position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
          fontSize: 10, color: "#9CA3AF", background: "#F2F2F2",
          border: "1px solid #E8E8E8", borderRadius: 3, padding: "1px 5px", fontFamily: "monospace",
        }}>⌘K</span>
      </div>

      {/* Modal overlay */}
      {open && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(0,0,0,0.35)",
          display: "flex", alignItems: "flex-start", justifyContent: "center",
          paddingTop: 100,
        }}>
          <div
            ref={containerRef}
            style={{
              background: "#FFFFFF",
              borderRadius: 12,
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
              width: "100%",
              maxWidth: 560,
              overflow: "hidden",
              border: "1px solid #E8E8E8",
            }}
          >
            {/* Input */}
            <div style={{ display: "flex", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid #F2F2F2", gap: 10 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                  fontSize: 14, color: "#292929", background: "transparent",
                }}
                autoFocus
              />
              {loading && (
                <div style={{ width: 14, height: 14, border: "2px solid #E8E8E8", borderTop: "2px solid #2563EB", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
              )}
              <button
                onClick={() => { setOpen(false); setQuery(""); }}
                style={{ fontSize: 11, color: "#9CA3AF", background: "#F2F2F2", border: "1px solid #E8E8E8", borderRadius: 4, padding: "2px 7px", cursor: "pointer", fontFamily: "monospace" }}
              >
                esc
              </button>
            </div>

            {/* Results */}
            {query.length >= 2 && (
              <div style={{ maxHeight: 420, overflowY: "auto" }}>
                {!hasResults && !loading && (
                  <div style={{ padding: "24px 16px", textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
                    No results for &ldquo;{query}&rdquo;
                  </div>
                )}

                {threads.length > 0 && (
                  <div>
                    <div style={{ padding: "8px 16px 4px", fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "1px" }}>
                      Threads
                    </div>
                    {threads.map((t, i) => {
                      const idx = i;
                      const isActive = idx === activeIdx;
                      return (
                        <button
                          key={t.id}
                          onClick={() => navigate("thread", t.id)}
                          onMouseEnter={() => setActiveIdx(idx)}
                          style={{
                            display: "flex", alignItems: "center", gap: 10, width: "100%",
                            padding: "9px 16px", textAlign: "left", border: "none",
                            background: isActive ? "#EFF6FF" : "transparent",
                            cursor: "pointer", borderRadius: 0,
                          }}
                        >
                          <div style={{ width: 7, height: 7, borderRadius: "50%", background: STATUS_COLOR[t.status] ?? "#D1D5DB", flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, color: "#292929", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {t.subject ?? "(no subject)"}
                            </div>
                            <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}>
                              {t.customerName ?? "Unknown"} · {t.status.replace(/_/g, " ")}
                            </div>
                          </div>
                          <div style={{ fontSize: 10, color: "#9CA3AF", flexShrink: 0 }}>
                            {t.lastMessageAt ? new Date(t.lastMessageAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {loads.length > 0 && (
                  <div style={{ borderTop: threads.length > 0 ? "1px solid #F2F2F2" : undefined }}>
                    <div style={{ padding: "8px 16px 4px", fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "1px" }}>
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
                            display: "flex", alignItems: "center", gap: 10, width: "100%",
                            padding: "9px 16px", textAlign: "left", border: "none",
                            background: isActive ? "#EFF6FF" : "transparent",
                            cursor: "pointer",
                          }}
                        >
                          <div style={{ width: 7, height: 7, borderRadius: 2, background: RISK_COLOR[l.riskLevel ?? "low"] ?? "#D1D5DB", flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, color: "#292929", fontWeight: 600, fontFamily: "monospace" }}>
                              {l.loadNumber}
                              {l.currentStatus && (
                                <span style={{ fontSize: 11, fontWeight: 400, color: "#9CA3AF", marginLeft: 8, fontFamily: "inherit" }}>
                                  {l.currentStatus}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {[l.customerName, l.originCity && l.destinationCity ? `${l.originCity}, ${l.originState} → ${l.destinationCity}, ${l.destinationState}` : null].filter(Boolean).join(" · ")}
                            </div>
                          </div>
                          <div style={{ fontSize: 10, color: "#9CA3AF", flexShrink: 0 }}>{l.carrierName ?? ""}</div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Footer hint */}
            <div style={{ padding: "8px 16px", borderTop: "1px solid #F2F2F2", display: "flex", gap: 12, alignItems: "center" }}>
              <span style={{ fontSize: 10, color: "#9CA3AF" }}>↑↓ navigate</span>
              <span style={{ fontSize: 10, color: "#9CA3AF" }}>↵ open</span>
              <span style={{ fontSize: 10, color: "#9CA3AF" }}>esc close</span>
            </div>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
    </>
  );
}
