"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

function IconMenu() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}
function IconSearch() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
function IconInbox() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}
function IconTruck() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13" />
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  );
}
function IconRules() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <circle cx="3" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="3" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="3" cy="18" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
function IconChart() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
      <line x1="2" y1="20" x2="22" y2="20" />
    </svg>
  );
}
function IconSettings() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

const NAV = [
  { label: "Inbox",     href: "/app/inbox",     Icon: IconInbox,    badge: true },
  { label: "Loads",     href: "/app/loads",     Icon: IconTruck,    badge: false },
  { label: "Rules",     href: "/app/rules",     Icon: IconRules,    badge: false },
  { label: "Analytics", href: "/app/analytics", Icon: IconChart,    badge: false },
  { label: "Settings",  href: "/app/settings",  Icon: IconSettings, badge: false },
];

function openSearch() {
  window.dispatchEvent(new CustomEvent("clyde:open-search"));
}

export function SidebarNav({
  inboxCount = 0,
  inboxEmail = null,
  collapsed = false,
  onToggle,
}: {
  inboxCount?: number;
  inboxEmail?: string | null;
  companyName?: string | null;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  const path = usePathname();

  if (collapsed) {
    return (
      <aside style={{
        width: 52,
        minWidth: 52,
        background: "#FFFFFF",
        borderRight: "1px solid #EBEBEB",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        overflow: "hidden",
        transition: "width 0.18s ease",
        paddingTop: 8,
        gap: 4,
      }}>
        {/* Toggle */}
        <button
          onClick={onToggle}
          title="Expand sidebar"
          style={{ padding: 8, background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", borderRadius: 6 }}
        >
          <IconMenu />
        </button>

        {/* Search */}
        <button
          onClick={openSearch}
          title="Search (⌘K)"
          style={{ padding: 8, background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", borderRadius: 6 }}
        >
          <IconSearch />
        </button>

        <div style={{ width: 28, height: 1, background: "#F2F2F2", margin: "4px 0" }} />

        {/* Nav icons */}
        {NAV.map(({ href, Icon, badge }) => {
          const active = path.startsWith(href);
          const showCount = badge && inboxCount > 0;
          return (
            <div key={href} style={{ position: "relative" }}>
              <Link
                href={href}
                title={href.split("/").pop()}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 36, height: 36, borderRadius: 8,
                  background: active ? "#EFF6FF" : "transparent",
                  color: active ? "#2563EB" : "#9CA3AF",
                  textDecoration: "none",
                }}
              >
                <Icon />
              </Link>
              {showCount && (
                <div style={{
                  position: "absolute", top: 2, right: 2,
                  width: 6, height: 6, borderRadius: "50%",
                  background: "#2563EB",
                }} />
              )}
            </div>
          );
        })}
      </aside>
    );
  }

  return (
    <aside style={{
      width: 200,
      minWidth: 200,
      background: "#FFFFFF",
      borderRight: "1px solid #EBEBEB",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      transition: "width 0.18s ease",
    }}>
      {/* Top: toggle + logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 12px 10px" }}>
        <button
          onClick={onToggle}
          title="Collapse sidebar"
          style={{ padding: 6, background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", borderRadius: 6, flexShrink: 0 }}
        >
          <IconMenu />
        </button>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#111827", letterSpacing: "1.5px", textTransform: "uppercase", lineHeight: 1 }}>
            CLYDE
          </div>
          <div style={{ fontSize: 9, color: "#9CA3AF", marginTop: 2, letterSpacing: "0.3px" }}>
            Freight AI Inbox
          </div>
        </div>
      </div>

      {/* Search button */}
      <div style={{ padding: "0 8px 8px" }}>
        <button
          onClick={openSearch}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            width: "100%", padding: "7px 10px",
            background: "#F9FAFB", border: "1px solid #EBEBEB",
            borderRadius: 7, cursor: "pointer", textAlign: "left",
          }}
        >
          <span style={{ color: "#9CA3AF" }}><IconSearch /></span>
          <span style={{ flex: 1, fontSize: 12, color: "#9CA3AF" }}>Search</span>
          <span style={{ fontSize: 10, color: "#B0B0B0", background: "#F2F2F2", border: "1px solid #E8E8E8", borderRadius: 3, padding: "1px 5px", fontFamily: "monospace" }}>
            ⌘K
          </span>
        </button>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "2px 8px", overflowY: "auto" }}>
        {NAV.map(({ label, href, Icon, badge }) => {
          const active = path.startsWith(href);
          const showCount = badge && inboxCount > 0;
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: "flex", alignItems: "center", gap: 9,
                padding: "7px 10px", borderRadius: 6,
                color: active ? "#111827" : "#6B7280",
                background: active ? "#EFF6FF" : "transparent",
                textDecoration: "none", fontSize: 13,
                fontWeight: active ? 600 : 400,
                marginBottom: 1,
                borderLeft: active ? "2px solid #2563EB" : "2px solid transparent",
              }}
            >
              <span style={{ color: active ? "#2563EB" : "#9CA3AF", flexShrink: 0 }}>
                <Icon />
              </span>
              <span style={{ flex: 1 }}>{label}</span>
              {showCount && (
                <span style={{ fontSize: 10, fontWeight: 700, background: "#DBEAFE", color: "#1D4ED8", padding: "1px 6px", borderRadius: 10, minWidth: 18, textAlign: "center" }}>
                  {inboxCount > 99 ? "99+" : inboxCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Inbox address footer */}
      {inboxEmail && (
        <div style={{ padding: "10px 14px", borderTop: "1px solid #F2F2F2" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#22C55E", flexShrink: 0 }} />
            <span style={{ fontSize: 9, color: "#9CA3AF", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Inbox active
            </span>
          </div>
          <div style={{ fontSize: 10, color: "#B0B0B0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {inboxEmail}
          </div>
        </div>
      )}
    </aside>
  );
}
