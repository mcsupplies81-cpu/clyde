export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="card" style={{ textAlign: "center", padding: 28 }}>
      <h3 style={{ margin: "0 0 8px" }}>{title}</h3>
      <p style={{ margin: 0, color: "#8ea0b5" }}>{description}</p>
    </div>
  );
}
