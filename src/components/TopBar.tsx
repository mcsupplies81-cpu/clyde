export function TopBar() {
  return (
    <header style={{ height: 48, background: "#0c111a", borderBottom: "1px solid #1e2d3d", display: "flex", alignItems: "center", padding: "0 20px", gap: 12, flexShrink: 0 }}>
      <input
        type="text"
        placeholder="Search threads, loads, carriers..."
        style={{ flex: 1, maxWidth: 400, background: "#141c24", border: "1px solid #253347", borderRadius: 6, padding: "6px 12px", color: "#d6e0eb", fontSize: 13, outline: "none" }}
      />
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} />
        <span style={{ fontSize: 12, color: "#7f92a8" }}>ops@harborfreight.demo</span>
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#1a2535", border: "1px solid #253347", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#7f92a8" }}>MW</div>
      </div>
    </header>
  );
}
