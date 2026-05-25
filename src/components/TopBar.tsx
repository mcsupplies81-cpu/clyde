export function TopBar() {
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
      <div style={{ position: "relative", flex: 1, maxWidth: 380 }}>
        <svg
          width="13" height="13"
          viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          placeholder="Search threads, loads, carriers…"
          style={{
            width: "100%",
            background: "#F9FAFB",
            border: "1px solid #E8E8E8",
            borderRadius: 6,
            padding: "6px 12px 6px 30px",
            color: "#292929",
            fontSize: 12,
            outline: "none",
          }}
        />
        <span style={{
          position: "absolute",
          right: 8,
          top: "50%",
          transform: "translateY(-50%)",
          fontSize: 10,
          color: "#9CA3AF",
          background: "#F2F2F2",
          border: "1px solid #E8E8E8",
          borderRadius: 3,
          padding: "1px 5px",
          fontFamily: "monospace",
        }}>
          ⌘K
        </span>
      </div>

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
          <span style={{ fontSize: 11, color: "#7F7F7F" }}>Harbor Freight</span>
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
