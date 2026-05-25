export function RiskBadge({ level }: { level: "Low" | "Medium" | "High" }) {
  const color = level === "High" ? "#ff6b6b" : level === "Medium" ? "#ffc06b" : "#72e3a1";
  return <span style={{ border: `1px solid ${color}66`, color, padding: "2px 8px", borderRadius: 6, fontSize: 12 }}>{level} Risk</span>;
}
