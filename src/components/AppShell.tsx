"use client";
import { useState, useEffect } from "react";
import { SidebarNav } from "./SidebarNav";
import { SearchModal } from "./SearchModal";

export function AppShell({
  children,
  inboxCount,
  inboxEmail,
  companyName,
  showAdminLink = false,
}: {
  children: React.ReactNode;
  inboxCount: number;
  inboxEmail: string | null;
  companyName: string | null;
  showAdminLink?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handler = () => setMobileOpen((o) => !o);
    window.addEventListener("clyde:toggle-mobile-sidebar", handler);
    return () => window.removeEventListener("clyde:toggle-mobile-sidebar", handler);
  }, []);

  useEffect(() => {
    const close = () => setMobileOpen(false);
    window.addEventListener("clyde:nav-click", close);
    return () => window.removeEventListener("clyde:nav-click", close);
  }, []);

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "#F8F8F7" }}>
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 98 }}
        />
      )}

      <div className={`app-sidebar-wrap${mobileOpen ? " mobile-open" : ""}`}>
        <SidebarNav
          inboxCount={inboxCount}
          inboxEmail={inboxEmail}
          companyName={companyName}
          collapsed={collapsed}
          showAdminLink={showAdminLink}
          onToggle={() => {
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
