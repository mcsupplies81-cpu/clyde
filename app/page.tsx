import { Nav } from '@/components/Nav';

export default function HomePage() {
  return (
    <main className="container">
      <h1>Clyde v1</h1>
      <p className="muted">Dispatch and sales copilot demo for broker teams.</p>
      <Nav />
      <div className="card">
        <h2>Welcome</h2>
        <p>Use the app navigation to view inbox triage, loads, rules, analytics, and settings.</p>
      </div>
    </main>
  );
}
