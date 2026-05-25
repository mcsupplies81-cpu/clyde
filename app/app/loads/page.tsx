import Link from "next/link";

export default function LoadsPage() {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h1 style={{ margin: 0, fontSize: 22 }}>Active Loads</h1>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div>LD-48291 • Dallas, TX → Phoenix, AZ</div>
          <Link href="/app/loads/LD-48291" style={{ color: "#89b6ff" }}>Open dossier</Link>
        </div>
      </div>
    </div>
  );
}
