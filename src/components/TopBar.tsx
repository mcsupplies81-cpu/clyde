import { SearchBar } from "./SearchBar";
import { UserButton } from "@clerk/nextjs";

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
        <span style={{ fontSize: 11, color: "#7F7F7F" }}>{companyName ?? "Clyde"}</span>
        <UserButton />
      </div>
    </header>
  );
}
