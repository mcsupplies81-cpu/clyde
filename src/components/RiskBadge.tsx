type RiskConfig = { bg: string; text: string; dot: string; label: string };

const RISK: Record<string, RiskConfig> = {
  low:      { bg: "#F0FDF4", text: "#16A34A", dot: "#22C55E", label: "Low Risk" },
  medium:   { bg: "#FFFBEB", text: "#D97706", dot: "#F59E0B", label: "Med Risk" },
  high:     { bg: "#FFF7ED", text: "#EA580C", dot: "#F97316", label: "High Risk" },
  critical: { bg: "#FEF2F2", text: "#DC2626", dot: "#EF4444", label: "Critical" },
};

export function RiskBadge({ level }: { level: string }) {
  const c = RISK[level] ?? RISK.low;
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      padding: "2px 8px",
      borderRadius: 4,
      background: c.bg,
      color: c.text,
      fontSize: 11,
      fontWeight: 600,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: c.dot, flexShrink: 0 }} />
      {c.label}
    </span>
  );
}
