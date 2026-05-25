import { RiskBadge } from "@/components/RiskBadge";

export default async function LoadDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h1 style={{ margin: 0, fontSize: 22 }}>Load Dossier: {id}</h1>
      <div className="card" style={{ display: "flex", justifyContent: "space-between" }}>
        <span>On-time probability model drift detected on final mile segment.</span>
        <RiskBadge level="Medium" />
      </div>
    </div>
  );
}
