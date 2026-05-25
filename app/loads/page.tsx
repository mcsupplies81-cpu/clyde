import Link from 'next/link';
import { getLoads } from '@/lib/db';

export default function LoadsPage({ searchParams }: { searchParams: { q?: string; status?: string; risk?: string } }) {
  const q = searchParams.q ?? '';
  const status = searchParams.status ?? '';
  const risk = searchParams.risk ?? '';
  const loads = getLoads(q, status, risk);

  return (
    <main style={{ padding: 24 }}>
      <h1>Loads</h1>
      <form style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input name="q" defaultValue={q} placeholder="Search load #, PO, customer, carrier, lane" style={{ flex: 1, padding: 8 }} />
        <select name="status" defaultValue={status}><option value="">All Statuses</option><option>In Transit</option><option>Delayed</option><option>Out for Delivery</option></select>
        <select name="risk" defaultValue={risk}><option value="">All Risk</option><option>Low</option><option>Medium</option><option>High</option></select>
        <button type="submit">Apply</button>
      </form>
      <table width="100%" cellPadding={8} style={{ borderCollapse: 'collapse', background: '#121a2c' }}>
        <thead><tr>{['load number','customer','carrier','lane','pickup','delivery','status','ETA','risk','related email count'].map(c=><th key={c} style={{textAlign:'left', borderBottom:'1px solid #24324d'}}>{c}</th>)}</tr></thead>
        <tbody>
          {loads.map((l) => (
            <tr key={l.id} style={{ borderBottom: '1px solid #1d2940' }}>
              <td><Link href={`/loads/${l.id}`}>{l.load_number}</Link></td><td>{l.customer}</td><td>{l.carrier}</td><td>{l.lane}</td>
              <td>{new Date(l.pickup_at).toLocaleString()}</td><td>{new Date(l.delivery_at).toLocaleString()}</td><td>{l.status}</td>
              <td>{new Date(l.eta).toLocaleString()}</td><td>{l.risk}</td><td>{l.email_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
