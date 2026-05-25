import { getLoadDetail } from '@/lib/db';
import { notFound } from 'next/navigation';

const card: React.CSSProperties = { background: '#121a2c', border: '1px solid #22314d', borderRadius: 10, padding: 14 };

export default function LoadDetail({ params }: { params: { id: string } }) {
  const detail = getLoadDetail(params.id);
  if (!detail) notFound();
  const { load, emails, notes, documents, timeline } = detail;

  return <main style={{ padding: 20 }}>
    <header style={{ ...card, marginBottom: 12 }}>
      <h1 style={{ margin: 0 }}>{load.load_number} · Freight Ops Workspace</h1>
      <p>{load.lane} | {load.equipment} | Status: {load.status} | ETA: {new Date(load.eta).toLocaleString()} | Risk: {load.risk}</p>
    </header>
    <section style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={card}><h3>Parties</h3><p>Customer: {load.customer} ({load.customer_contact})</p><p>Carrier: {load.carrier} ({load.carrier_contact})</p><p>PO: {load.po}</p></div>
        <div style={card}><h3>Route & Appointments</h3><p>Lane: {load.lane}</p><p>Pickup: {new Date(load.pickup_at).toLocaleString()}</p><p>Delivery: {new Date(load.delivery_at).toLocaleString()}</p><p>Current Location: {load.current_location}</p></div>
        <div style={card}><h3>Internal Notes</h3>{notes.length ? notes.map((n:any)=><p key={n.id}><b>{n.author}</b>: {n.body}</p>) : <p>No notes yet.</p>}</div>
        <div style={card}><h3>Documents</h3><ul>{documents.map((d:any)=><li key={d.id}>{d.name} · {d.type}</li>)}</ul></div>
      </div>
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={card}><h3>Related Email Threads</h3>{emails.map((e:any)=><article key={e.id} style={{marginBottom:8}}><strong>{e.subject}</strong><p style={{margin:'4px 0'}}>{e.snippet}</p><small>{e.participants}</small></article>)}</div>
        <div style={card}><h3>AI Activity / Audit Timeline</h3><ul>{timeline.map((t:any)=><li key={t.id}><b>{t.event_type}</b> — {t.detail} <small>({t.actor})</small></li>)}</ul></div>
      </div>
    </section>
  </main>;
}
