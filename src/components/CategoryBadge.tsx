type CatConfig = { label: string; color: string; bg: string };

const CAT: Record<string, CatConfig> = {
  status_request:        { label: "Status Update",  color: "#1D4ED8", bg: "#EFF6FF" },
  quote_request:         { label: "Quote Request",  color: "#7C3AED", bg: "#F5F3FF" },
  pod_request:           { label: "POD Request",    color: "#059669", bg: "#ECFDF5" },
  bol_request:           { label: "BOL Request",    color: "#0D9488", bg: "#F0FDFA" },
  rate_confirmation:     { label: "Rate Con",       color: "#2563EB", bg: "#EFF6FF" },
  carrier_update:        { label: "Carrier Update", color: "#0284C7", bg: "#F0F9FF" },
  appointment_change:    { label: "Appointment",    color: "#D97706", bg: "#FFFBEB" },
  detention_accessorial: { label: "Detention",      color: "#EA580C", bg: "#FFF7ED" },
  billing_invoice:       { label: "Billing",        color: "#7C3AED", bg: "#F5F3FF" },
  escalation:            { label: "Escalation",     color: "#DC2626", bg: "#FEF2F2" },
  unknown:               { label: "Unclassified",   color: "#6B7280", bg: "#F9FAFB" },
};

export function CategoryBadge({ category }: { category: string }) {
  const c = CAT[category] ?? { label: category.replace(/_/g, " "), color: "#6B7280", bg: "#F9FAFB" };
  return (
    <span style={{
      fontSize: 11,
      fontWeight: 600,
      color: c.color,
      background: c.bg,
      padding: "2px 8px",
      borderRadius: 4,
      whiteSpace: "nowrap",
      letterSpacing: "0.1px",
    }}>
      {c.label}
    </span>
  );
}
