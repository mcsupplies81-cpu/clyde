import Link from 'next/link';

type Thread = {
  id: string; subject: string; senderName: string; category: string; status: string; priority: string; lastMessageAt: Date; matchedLoadId: string | null;
};

export function ThreadList({ threads, selectedThreadId }: { threads: Thread[]; selectedThreadId: string }) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {threads.map((t) => (
        <Link key={t.id} href={`/app/inbox?threadId=${t.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
          <article style={{ border: t.id === selectedThreadId ? '2px solid #2563eb' : '1px solid #d1d5db', borderRadius: 10, padding: 10, background: '#fff' }}>
            <div style={{ fontWeight: 700 }}>{t.subject}</div>
            <div>{t.senderName}</div>
            <div style={{ fontSize: 12 }}>{t.category} • {t.priority} • {t.status}</div>
            <div style={{ fontSize: 12 }}>{new Date(t.lastMessageAt).toLocaleTimeString()} {t.matchedLoadId ? `• ${t.matchedLoadId}` : ''}</div>
          </article>
        </Link>
      ))}
    </div>
  );
}
