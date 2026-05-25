const colors: Record<string, { bg: string; text: string }> = {
  "In Transit": { bg: "#1e3a5f", text: "#60a5fa" },
  "Delivered": { bg: "#14532d", text: "#4ade80" },
  "Delivered - POD Pending": { bg: "#1c3d27", text: "#86efac" },
  "Booked": { bg: "#1e2d4a", text: "#93c5fd" },
  "At Pickup": { bg: "#2d2a14", text: "#fde047" },
  "Delayed": { bg: "#451a03", text: "#fb923c" },
  "Exception": { bg: "#450a0a", text: "#f87171" },
  "open": { bg: "#1e2d4a", text: "#93c5fd" },
  "pending_review": { bg: "#2d2a14", text: "#fde047" },
  "drafted": { bg: "#1c3d27", text: "#86efac" },
  "resolved": { bg: "#14532d", text: "#4ade80" },
  "escalated": { bg: "#450a0a", text: "#f87171" },
};

const DEFAULT = { bg: "#1a2535", text: "#7f92a8" };

export function StatusBadge({ status }: { status: string }) {
  const c = colors[status] ?? DEFAULT;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 4, background: c.bg, color: c.text, fontSize: 11, fontWeight: 500, letterSpacing: "0.3px", whiteSpace: "nowrap" }}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
