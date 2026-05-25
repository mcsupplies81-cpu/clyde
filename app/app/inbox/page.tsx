import { CategoryBadge } from "@/components/CategoryBadge";
import { RiskBadge } from "@/components/RiskBadge";

export default function InboxPage() {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h1 style={{ margin: 0, fontSize: 22 }}>Operations Inbox</h1>
      <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 600 }}>Detention escalation: ORD outbound cluster</div>
          <div style={{ color: "#8ea0b5", fontSize: 13 }}>11 loads approaching appointment risk window.</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}><CategoryBadge label="Exception" /><RiskBadge level="High" /></div>
      </div>
    </div>
  );
}
