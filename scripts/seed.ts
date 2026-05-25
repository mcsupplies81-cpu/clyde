import { db } from '../src/db/client';
import { loads, emails, emailLoadMatches, draftReplies, auditLogs } from '../src/db/schema';

async function run() {
  const [load] = await db.insert(loads).values({
    loadNumber: 'CLY-1001', origin: 'Dallas, TX', destination: 'Atlanta, GA', status: 'in_transit',
    pickupAt: new Date('2026-05-23T14:00:00Z'), deliveryAt: new Date('2026-05-26T20:00:00Z'),
  }).returning();

  const [email] = await db.insert(emails).values({
    subject: 'Update on CLY-1001 ETA', from: 'dispatch@carrierco.com', body: 'Driver delayed 2 hours due weather.', classification: 'status_update',
  }).returning();

  await db.insert(emailLoadMatches).values({ emailId: email.id, loadId: load.id, confidence: '0.93', method: 'load_number' });
  await db.insert(draftReplies).values({ emailId: email.id, text: 'Thanks for the update. Please confirm revised ETA at Atlanta consignee.', model: 'gpt-4.1-mini' });
  await db.insert(auditLogs).values({ actor: 'operator', action: 'draft_approved', entityType: 'draft_reply', entityId: email.id, payload: '{"note":"approved in demo"}' });

  console.log('Seed completed');
}

run().catch((err) => { console.error(err); process.exit(1); });
