type StatusConfig = { bg: string; text: string; label: string };

const STATUS: Record<string, StatusConfig> = {
  // Thread DB statuses
  open:                    { bg: "#EFF6FF", text: "#1D4ED8", label: "Open" },
  pending_review:          { bg: "#FFFBEB", text: "#D97706", label: "Needs Review" },
  drafted:                 { bg: "#ECFDF5", text: "#059669", label: "Draft Ready" },
  sent:                    { bg: "#F0FDF4", text: "#15803D", label: "Sent" },
  resolved:                { bg: "#F0FDF4", text: "#15803D", label: "Resolved" },
  escalated:               { bg: "#FEF2F2", text: "#DC2626", label: "Escalated" },

  // Derived workflow states (used by WorkflowBadge)
  classified:              { bg: "#F5F3FF", text: "#7C3AED", label: "Classified" },
  matched:                 { bg: "#F0F9FF", text: "#0284C7", label: "Load Matched" },
  awaiting_approval:       { bg: "#FFFBEB", text: "#D97706", label: "Needs Approval" },
  approved_ready_to_send:  { bg: "#F0FDF4", text: "#15803D", label: "Ready to Send" },

  // Load statuses
  "In Transit":            { bg: "#EFF6FF", text: "#1D4ED8", label: "In Transit" },
  "Delivered":             { bg: "#F0FDF4", text: "#15803D", label: "Delivered" },
  "Delivered - POD Pending": { bg: "#ECFDF5", text: "#059669", label: "Delivered — POD Pending" },
  "Booked":                { bg: "#EFF6FF", text: "#2563EB", label: "Booked" },
  "Dispatched":            { bg: "#EFF6FF", text: "#0284C7", label: "Dispatched" },
  "At Pickup":             { bg: "#FFFBEB", text: "#D97706", label: "At Pickup" },
  "Out for Delivery":      { bg: "#ECFDF5", text: "#059669", label: "Out for Delivery" },
  "Delayed":               { bg: "#FFF7ED", text: "#EA580C", label: "Delayed" },
  "Exception":             { bg: "#FEF2F2", text: "#DC2626", label: "Exception" },
  "Unknown":               { bg: "#F9FAFB", text: "#6B7280", label: "Unknown" },
};

const DEFAULT: StatusConfig = { bg: "#F9FAFB", text: "#6B7280", label: "" };

export function StatusBadge({ status }: { status: string }) {
  const c = STATUS[status] ?? DEFAULT;
  const label = c.label || status.replace(/_/g, " ");
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      padding: "2px 8px",
      borderRadius: 4,
      background: c.bg,
      color: c.text,
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.1px",
      whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

export function WorkflowBadge({ state }: { state: string }) {
  return <StatusBadge status={state} />;
}
