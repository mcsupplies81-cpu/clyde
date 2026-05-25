import { demoTenant } from "@/data/demo";
import { StatusBadge } from "./StatusBadge";

export function TopBar() {
  return (
    <header className="topbar">
      <div style={{ fontWeight: 700, letterSpacing: 0.3 }}>CLYDE</div>
      <input placeholder="Search loads, shippers, lane exceptions..." style={{ flex: 1, maxWidth: 620, background: "#0a1017", border: "1px solid #253242", color: "#cfdae5", borderRadius: 8, padding: "8px 12px" }} />
      <div style={{ fontSize: 13, color: "#a8b6c6" }}>{demoTenant.name}</div>
      <StatusBadge label={demoTenant.status} />
    </header>
  );
}
