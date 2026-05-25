import Link from 'next/link';

export default function HomePage() {
  return (
    <main>
      <div className="card">
        <h1>Clyde Admin</h1>
        <p>Manage SOP rule behavior for response drafting and routing.</p>
        <Link href="/rules">Open SOP Rules</Link>
      </div>
    </main>
  );
}
