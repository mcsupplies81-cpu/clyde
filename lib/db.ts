import Database from 'better-sqlite3';
import path from 'node:path';

const dbPath = path.join(process.cwd(), 'data', 'loads.db');
const db = new Database(dbPath, { readonly: true });

export type LoadRow = {
  id: string; load_number: string; customer: string; carrier: string; lane: string;
  pickup_at: string; delivery_at: string; status: string; eta: string; risk: string; po: string;
  customer_contact: string; carrier_contact: string; equipment: string; current_location: string;
};

export function getLoads(search = '', status = '', risk = ''): (LoadRow & { email_count: number })[] {
  const q = `%${search.toLowerCase()}%`;
  return db.prepare(`
    SELECT l.*, COUNT(e.id) as email_count
    FROM loads l
    LEFT JOIN emails e ON e.load_id = l.id
    WHERE (? = '' OR l.status = ?)
      AND (? = '' OR l.risk = ?)
      AND (? = '' OR lower(l.load_number || ' ' || l.po || ' ' || l.customer || ' ' || l.carrier || ' ' || l.lane) LIKE ?)
    GROUP BY l.id
    ORDER BY l.pickup_at DESC
  `).all(status, status, risk, risk, search, q) as (LoadRow & { email_count: number })[];
}

export function getLoadDetail(id: string) {
  const load = db.prepare('SELECT * FROM loads WHERE id = ?').get(id) as LoadRow | undefined;
  if (!load) return null;
  const emails = db.prepare('SELECT * FROM emails WHERE load_id = ? ORDER BY last_message_at DESC').all(id);
  const notes = db.prepare('SELECT * FROM notes WHERE load_id = ? ORDER BY created_at DESC').all(id);
  const documents = db.prepare('SELECT * FROM documents WHERE load_id = ? ORDER BY uploaded_at DESC').all(id);
  const timeline = db.prepare('SELECT * FROM timeline WHERE load_id = ? ORDER BY created_at DESC').all(id);
  return { load, emails, notes, documents, timeline };
}
