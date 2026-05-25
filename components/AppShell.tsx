import { ReactNode } from "react";
import { SidebarNav } from "./SidebarNav";
import { TopBar } from "./TopBar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      <SidebarNav />
      <div>
        <TopBar />
        <main className="main">{children}</main>
      </div>
    </div>
  );
}
