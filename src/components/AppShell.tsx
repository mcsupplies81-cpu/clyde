"use client";
import { useState, useEffect } from "react";
import { SidebarNav } from "./SidebarNav";
import { SearchModal } from "./SearchModal";

export function AppShell({
  children,
  inboxCount,
  inboxEmail,
  companyName,
}: {
  children: React.ReactNode;
  inboxCount: number;
  inboxEmail: string | null;
  companyName: string | null;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Listen for mobile sidebar toggle events (from hamburger in top bar / TopBar)
  useEffect(() => {
    const handler = () => setMobileOpen((o) => !o);
    window.addEventListener("clyde:toggle-mobile-sidebar", handler);
    return () => window.removeEventListener("clyde:toggle-mobile-sidebar", handler);
  }, []);

  // Close mobile sidebar on route change
  useEffect(() => {
    const close = () => setMobileOpen(false);
    window.addEventListener("clyde:nav-click", close);
    return () => window.removeEventListener("clyde:nav-click", close);
  }, []);

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "#F8F8F7" }}>

      {/* Mobile overlay — dims content when sidebar open */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.4)",
            zIndex: 98,
          }}
        />
      )}

      {/* Sidebar wrapper — slides in on mobile */}
      <div className={`app-sidebar-wrap${mobileOpen ? " mobile-open" : ""}`}>
        <SidebarNav
          inboxCount={inboxCount}
          inboxEmail={inboxEmail}
          companyName={companyName}
          collapsed={collapsed}
          onToggle={() => {
            // Desktop: collapse/expand. Mobile: close (hamburger is inside sidebar)
            if (typeof window !== "undefined" && window.innerWidth < 768) {
              setMobileOpen(false);
            } else {
              setCollapsed((c) => !c);
            }
          }}
        />
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        {children}
      </div>

      <SearchModal />
    </div>
  );
}
