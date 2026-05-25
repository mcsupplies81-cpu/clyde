import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const dataDir = path.join(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'loads.db');
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(dbPath);

db.exec(`
DROP TABLE IF EXISTS loads;
DROP TABLE IF EXISTS emails;
DROP TABLE IF EXISTS notes;
DROP TABLE IF EXISTS documents;
DROP TABLE IF EXISTS timeline;

CREATE TABLE loads (
  id TEXT PRIMARY KEY,
  load_number TEXT NOT NULL,
  customer TEXT NOT NULL,
  carrier TEXT NOT NULL,
  lane TEXT NOT NULL,
  pickup_at TEXT NOT NULL,
  delivery_at TEXT NOT NULL,
  status TEXT NOT NULL,
  eta TEXT NOT NULL,
  risk TEXT NOT NULL,
  po TEXT NOT NULL,
  customer_contact TEXT NOT NULL,
  carrier_contact TEXT NOT NULL,
  equipment TEXT NOT NULL,
  current_location TEXT NOT NULL
);
CREATE TABLE emails (id INTEGER PRIMARY KEY AUTOINCREMENT, load_id TEXT, subject TEXT, participants TEXT, last_message_at TEXT, snippet TEXT);
CREATE TABLE notes (id INTEGER PRIMARY KEY AUTOINCREMENT, load_id TEXT, author TEXT, body TEXT, created_at TEXT);
CREATE TABLE documents (id INTEGER PRIMARY KEY AUTOINCREMENT, load_id TEXT, name TEXT, type TEXT, uploaded_at TEXT);
CREATE TABLE timeline (id INTEGER PRIMARY KEY AUTOINCREMENT, load_id TEXT, event_type TEXT, actor TEXT, detail TEXT, created_at TEXT);
`);

const loads = [
  ['ld_101','L-884221','Northwind Foods','BlueLine Logistics','Fresno, CA → Denver, CO','2026-05-24T09:00:00Z','2026-05-26T17:00:00Z','In Transit','2026-05-26T19:30:00Z','Medium','PO-19443','Maya Chen','Luis Ortega','53\' Reefer','Salina, KS'],
  ['ld_102','L-884310','Aster Medical','JetHaul Freight','Phoenix, AZ → Dallas, TX','2026-05-25T06:00:00Z','2026-05-26T13:00:00Z','Delayed','2026-05-26T21:00:00Z','High','PO-19510','Jared Evans','Nina Patel','Dry Van','Abilene, TX'],
  ['ld_103','L-884399','Cobalt Retail','Summit Carriers','Reno, NV → Portland, OR','2026-05-25T08:30:00Z','2026-05-25T22:00:00Z','Out for Delivery','2026-05-25T22:15:00Z','Low','PO-19542','Priya Raman','Tom Becker','Dry Van','Eugene, OR']
];

const insLoad = db.prepare('INSERT INTO loads VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
for (const row of loads) insLoad.run(...row);

const insEmail = db.prepare('INSERT INTO emails (load_id,subject,participants,last_message_at,snippet) VALUES (?,?,?,?,?)');
[['ld_101','Temp variance alarm on trailer 142','ops@northwind.com; dispatch@blueline.com','2026-05-25T09:12:00Z','Reefer came back into range after stop.'],
['ld_101','Driver check call summary','csr@clyde.com; luis@blueline.com','2026-05-25T07:48:00Z','Driver reports no detention at fuel stop.'],
['ld_102','Critical: appointment miss risk','ops@aster.com; dispatch@jethaul.com','2026-05-25T10:02:00Z','Traffic + HOS likely to impact 13:00 delivery.'],
['ld_103','POD requirements reminder','dc-portland@cobalt.com; tom@summit.com','2026-05-25T11:24:00Z','Receiver requires stamped POD by midnight.']].forEach(r=>insEmail.run(...r));

const insNote = db.prepare('INSERT INTO notes (load_id,author,body,created_at) VALUES (?,?,?,?)');
[['ld_102','Alex (Ops)','Escalated to carrier manager. Requesting team driver relay option.','2026-05-25T10:15:00Z'],['ld_102','Iris (CSR)','Customer notified of revised ETA and mitigation plan.','2026-05-25T10:26:00Z']].forEach(r=>insNote.run(...r));

const insDoc = db.prepare('INSERT INTO documents (load_id,name,type,uploaded_at) VALUES (?,?,?,?)');
[['ld_101','Rate Confirmation - L-884221.pdf','Rate Con','2026-05-24T08:22:00Z'],['ld_101','BOL - Pickup.pdf','BOL','2026-05-24T11:03:00Z'],['ld_102','Temp Exception Form.pdf','Exception','2026-05-25T10:18:00Z']].forEach(r=>insDoc.run(...r));

const insTimeline = db.prepare('INSERT INTO timeline (load_id,event_type,actor,detail,created_at) VALUES (?,?,?,?,?)');
[['ld_102','AI Alert','Clyde AI','Predicted 82% probability of late delivery based on traffic + HOS.','2026-05-25T09:55:00Z'],['ld_102','Manual Action','Alex (Ops)','Called carrier dispatcher and requested recovery options.','2026-05-25T10:03:00Z'],['ld_102','Email Sent','Iris (CSR)','Sent revised ETA update to Aster Medical.','2026-05-25T10:27:00Z']].forEach(r=>insTimeline.run(...r));

db.close();
console.log('Seeded', dbPath);
