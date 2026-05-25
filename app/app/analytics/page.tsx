import { MetricCard } from "@/components/MetricCard";

export default function AnalyticsPage() {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h1 style={{ margin: 0, fontSize: 22 }}>Network Analytics</h1>
      <div className="grid">
        <MetricCard label="On-Time Pickup" value="96.2%" delta="+0.8 vs last week" />
        <MetricCard label="Tender Acceptance" value="92.4%" delta="+1.1 vs last week" />
        <MetricCard label="Exception Rate" value="7.9%" delta="-0.6 vs last week" />
        <MetricCard label="Cost / Mile" value="$2.31" delta="-$0.04 vs last week" />
      </div>
    </div>
  );
}
