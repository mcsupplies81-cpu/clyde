"use client";
import { useState } from "react";
import { SidebarNav } from "./SidebarNav";

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

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "#F8F8F7" }}>
      <SidebarNav
        inboxCount={inboxCount}
        inboxEmail={inboxEmail}
        companyName={companyName}
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
      />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {children}
      </div>
    </div>
  );
}
