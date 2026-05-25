export function relativeTime(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return days === 1 ? "1d ago" : `${days}d ago`;
}

export function fmtDate(v: Date | string | null | undefined): string {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function fmtDateTime(v: Date | string | null | undefined): string {
  if (!v) return "—";
  return new Date(v).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function fmtCurrency(v: string | number | null | undefined): string {
  if (!v) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(v));
}

export function etaLabel(eta: Date | string | null | undefined): { text: string; color: string } {
  if (!eta) return { text: "ETA unknown", color: "#253347" };
  const diff = new Date(eta).getTime() - Date.now();
  const hrs = Math.round(diff / 3600000);
  if (diff < 0) return { text: `Overdue by ${Math.abs(hrs)}h`, color: "#ef4444" };
  if (hrs < 4)  return { text: `ETA in ${hrs}h`, color: "#f97316" };
  if (hrs < 24) return { text: `ETA in ${hrs}h`, color: "#fbbf24" };
  return { text: `ETA in ${Math.floor(hrs / 24)}d`, color: "#4ade80" };
}

export function statusProgress(status: string | null | undefined): number {
  const map: Record<string, number> = {
    booked: 10, dispatched: 25, "at pickup": 40,
    "in transit": 60, "out for delivery": 80, delivered: 100, exception: 45,
  };
  return map[(status ?? "").toLowerCase()] ?? 0;
}
