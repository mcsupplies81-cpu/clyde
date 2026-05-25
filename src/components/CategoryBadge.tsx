const cat: Record<string, { label: string; color: string }> = {
  status_request: { label: "Status", color: "#60a5fa" },
  quote_request: { label: "Quote", color: "#a78bfa" },
  pod_request: { label: "POD", color: "#34d399" },
  bol_request: { label: "BOL", color: "#6ee7b7" },
  rate_confirmation: { label: "Rate Con", color: "#93c5fd" },
  carrier_update: { label: "Carrier Update", color: "#7dd3fc" },
  appointment_change: { label: "Appointment", color: "#fde047" },
  detention_accessorial: { label: "Detention", color: "#fb923c" },
  billing_invoice: { label: "Billing", color: "#c4b5fd" },
  escalation: { label: "Escalation", color: "#f87171" },
  unknown: { label: "Unknown", color: "#7f92a8" },
};

export function CategoryBadge({ category }: { category: string }) {
  const c = cat[category] ?? { label: category, color: "#7f92a8" };
  return (
    <span style={{ fontSize: 11, fontWeight: 500, color: c.color, background: `${c.color}1a`, padding: "2px 7px", borderRadius: 4, whiteSpace: "nowrap" }}>
      {c.label}
    </span>
  );
}
