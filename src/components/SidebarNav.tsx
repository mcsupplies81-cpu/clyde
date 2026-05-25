"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { label: "Inbox", href: "/app/inbox", icon: "▤" },
  { label: "Loads", href: "/app/loads", icon: "◫" },
  { label: "Rules", href: "/app/rules", icon: "≡" },
  { label: "Analytics", href: "/app/analytics", icon: "◈" },
  { label: "Settings", href: "/app/settings", icon: "◎" },
];

export function SidebarNav() {
  const path = usePathname();
  return (
    <aside style={{ width: 200, minWidth: 200, background: "#0c111a", borderRight: "1px solid #1e2d3d", display: "flex", flexDirection: "column", padding: "16px 0" }}>
      <div style={{ padding: "0 16px 20px", borderBottom: "1px solid #1e2d3d", marginBottom: 8 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#d6e0eb", letterSpacing: "-0.5px" }}>Clyde</div>
        <div style={{ fontSize: 11, color: "#4a5e75", marginTop: 2 }}>Harbor Freight Demo</div>
      </div>
      {nav.map(({ label, href, icon }) => {
        const active = path.startsWith(href);
        return (
          <Link key={href} href={href} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 16px", color: active ? "#d6e0eb" : "#7f92a8", background: active ? "#1a2535" : "transparent", borderLeft: active ? "2px solid #3b82f6" : "2px solid transparent", textDecoration: "none", fontSize: 13, fontWeight: active ? 500 : 400, transition: "all 0.1s" }}>
            <span style={{ fontSize: 14 }}>{icon}</span>
            {label}
          </Link>
        );
      })}
    </aside>
  );
}
