import Link from "next/link";

const items = [
  ["Inbox", "/app/inbox"],
  ["Loads", "/app/loads"],
  ["Rules", "/app/rules"],
  ["Analytics", "/app/analytics"],
  ["Settings", "/app/settings"],
] as const;

export function SidebarNav() {
  return (
    <nav className="sidebar">
      <div style={{ marginBottom: 16, fontSize: 12, color: "#7f92a8", textTransform: "uppercase" }}>Command Surface</div>
      {items.map(([label, href]) => (
        <Link key={href} href={href} style={{ display: "block", padding: "10px 12px", borderRadius: 8, color: "#d6e0eb" }}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
