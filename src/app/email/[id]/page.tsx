import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { auditLogs, draftReplies, emailLoadMatches, emails, loads } from '@/db/schema';

export default async function EmailDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [email] = await db.select().from(emails).where(eq(emails.id, id));
  if (!email) return <main className="p-6">Not found.</main>;

  const [match] = await db.select().from(emailLoadMatches).where(eq(emailLoadMatches.emailId, id));
  const load = match ? (await db.select().from(loads).where(eq(loads.id, match.loadId)))[0] : null;
  const [draft] = await db.select().from(draftReplies).where(eq(draftReplies.emailId, id));
  const logs = await db.select().from(auditLogs).where(eq(auditLogs.entityId, id));

  return <main className="mx-auto grid max-w-6xl grid-cols-2 gap-6 p-6">
    <section className="rounded border bg-white p-4">
      <h2 className="font-bold">{email.subject}</h2><p>{email.body}</p>
    </section>
    <section className="space-y-4">
      <div className="rounded border bg-white p-4"><h3 className="font-semibold">Matched Load</h3>{load ? <p>{load.loadNumber}: {load.origin} → {load.destination}</p> : <p>Unmatched</p>}</div>
      <div className="rounded border bg-white p-4"><h3 className="font-semibold">Draft Reply</h3><p>{draft?.text ?? 'No draft yet.'}</p></div>
      <div className="rounded border bg-white p-4"><h3 className="font-semibold">Audit Log</h3>{logs.map((l)=><p key={l.id} className="text-sm">{l.action} by {l.actor}</p>)}</div>
    </section>
  </main>;
}
