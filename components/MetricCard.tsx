export function MetricCard({ label, value, delta }: { label: string; value: string; delta: string }) {
  return (
    <div className="card">
      <div style={{ color: "#8ea0b5", fontSize: 12 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 650, margin: "6px 0" }}>{value}</div>
      <div style={{ fontSize: 12, color: "#7eb6ff" }}>{delta}</div>
    </div>
  );
}
