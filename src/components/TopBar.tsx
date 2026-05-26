import { SearchBar } from "./SearchBar";

export function TopBar({ companyName }: { companyName?: string | null }) {
  return (
    <header style={{
      height: 46,
      background: "#FFFFFF",
      borderBottom: "1px solid #E8E8E8",
      display: "flex",
      alignItems: "center",
      padding: "0 16px",
      gap: 12,
      flexShrink: 0,
    }}>
      <SearchBar />

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E" }} />
          <span style={{ fontSize: 11, color: "#9CA3AF" }}>Connected</span>
        </div>
        <div style={{ width: 1, height: 16, background: "#E8E8E8" }} />
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          cursor: "pointer",
        }}>
          <span style={{ fontSize: 11, color: "#7F7F7F" }}>{companyName ?? "Clyde"}</span>
          <div style={{
            width: 26,
            height: 26,
            borderRadius: 6,
            background: "#EFF6FF",
            border: "1px solid #BFDBFE",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 10,
            fontWeight: 700,
            color: "#2563EB",
          }}>
            MW
          </div>
        </div>
      </div>
    </header>
  );
}
