import Link from 'next/link';

const links = [
  ['Home', '/'],
  ['Inbox', '/app/inbox'],
  ['Loads', '/app/loads'],
  ['Rules', '/app/rules'],
  ['Analytics', '/app/analytics'],
  ['Settings', '/app/settings']
] as const;

export function Nav() {
  return (
    <nav className="nav">
      {links.map(([label, href]) => (
        <Link key={href} href={href}>{label}</Link>
      ))}
    </nav>
  );
}
