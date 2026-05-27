import { UserButton } from "@clerk/nextjs";

export function TopBar({ companyName }: { companyName?: string | null }) {
  return (
    <header style={{
      height: 46,
      background: "#FFFFFF",
      borderBottom: "1px solid #EBEBEB",
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-end",
      padding: "0 16px",
      gap: 12,
      flexShrink: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#22C55E" }} />
        <span style={{ fontSize: 11, color: "#9CA3AF" }}>Live</span>
      </div>
      <div style={{ width: 1, height: 14, background: "#E8E8E8" }} />
      <span className="topbar-company" style={{ fontSize: 11, color: "#7F7F7F", fontWeight: 500 }}>{companyName ?? "Clyde"}</span>
      <UserButton />
    </header>
  );
}
