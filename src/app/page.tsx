import Link from 'next/link';
import { desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { emails } from '@/db/schema';

export default async function HomePage() {
  const rows = await db.select().from(emails).orderBy(desc(emails.receivedAt)).limit(50);
  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold mb-4">Clyde Inbox</h1>
      <div className="space-y-3">
        {rows.map((email) => (
          <Link key={email.id} href={`/email/${email.id}`} className="block rounded-lg border bg-white p-4">
            <p className="text-sm text-slate-500">{email.from}</p>
            <p className="font-semibold">{email.subject}</p>
            <span className="text-xs rounded bg-slate-100 px-2 py-1">{email.classification}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
