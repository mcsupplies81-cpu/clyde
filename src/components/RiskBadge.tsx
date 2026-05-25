const risk: Record<string, { bg: string; text: string; dot: string }> = {
  low: { bg: "#0f2318", text: "#4ade80", dot: "#22c55e" },
  medium: { bg: "#2d2010", text: "#fbbf24", dot: "#f59e0b" },
  high: { bg: "#2d0f0f", text: "#f87171", dot: "#ef4444" },
};

export function RiskBadge({ level }: { level: string }) {
  const c = risk[level] ?? risk.low;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 8px", borderRadius: 4, background: c.bg, color: c.text, fontSize: 11, fontWeight: 500 }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: c.dot }} />
      {level} risk
    </span>
  );
}
