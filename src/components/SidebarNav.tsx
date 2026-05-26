"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

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

export function SidebarNav({
  inboxCount = 0,
  inboxEmail = null,
  companyName = null,
}: {
  inboxCount?: number;
  inboxEmail?: string | null;
  companyName?: string | null;
}) {
  const path = usePathname();

  return (
    <aside style={{
      width: 212,
      minWidth: 212,
      background: "#FFFFFF",
      borderRight: "1px solid #E8E8E8",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    }}>
      {/* Logo */}
      <div style={{ padding: "18px 16px 14px", borderBottom: "1px solid #F2F2F2" }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#292929", letterSpacing: "1.5px", textTransform: "uppercase" }}>
          CLYDE
        </div>
        <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 2, letterSpacing: "0.5px" }}>
          Freight AI Inbox
        </div>
      </div>

      {/* Inbox status */}
      <div style={{ padding: "10px 16px", borderBottom: "1px solid #F2F2F2" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: inboxEmail ? "#22C55E" : "#D1D5DB", flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: "#5D5D5D", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {inboxEmail ?? "No inbox connected"}
          </span>
        </div>
        <div style={{ fontSize: 10, color: "#9CA3AF", paddingLeft: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {companyName ?? "—"}
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "6px 8px", overflowY: "auto" }}>
        {NAV.map(({ label, href, Icon, badge }) => {
          const active = path.startsWith(href);
          const showCount = badge && inboxCount > 0;
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                borderRadius: 6,
                color: active ? "#292929" : "#7F7F7F",
                background: active ? "#EFF6FF" : "transparent",
                textDecoration: "none",
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                marginBottom: 1,
                position: "relative",
              }}
            >
              <span style={{ color: active ? "#2563EB" : "#9CA3AF", flexShrink: 0 }}>
                <Icon />
              </span>
              <span style={{ flex: 1 }}>{label}</span>
              {showCount && (
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  background: "#EFF6FF",
                  color: "#2563EB",
                  padding: "1px 6px",
                  borderRadius: 10,
                  minWidth: 18,
                  textAlign: "center",
                }}>
                  {inboxCount > 99 ? "99+" : inboxCount}
                </span>
              )}
              {active && (
                <div style={{
                  position: "absolute",
                  left: 0,
                  top: "20%",
                  bottom: "20%",
                  width: 2,
                  background: "#2563EB",
                  borderRadius: "0 2px 2px 0",
                }} />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User card */}
      <div style={{
        padding: "12px 14px",
        borderTop: "1px solid #F2F2F2",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}>
        <div style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          background: "#EFF6FF",
          border: "1px solid #BFDBFE",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          fontWeight: 700,
          color: "#2563EB",
          flexShrink: 0,
        }}>
          MW
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#292929", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            Marcus Webb
          </div>
          <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 1 }}>Operations Lead</div>
        </div>
      </div>
    </aside>
  );
}
