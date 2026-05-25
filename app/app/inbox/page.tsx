import { getInboxData } from '@/db/queries';
import { ThreadList } from '@/components/inbox/ThreadList';

type Props = { searchParams: Promise<{ threadId?: string }> };

export default async function InboxPage({ searchParams }: Props) {
  const params = await searchParams;
  const data = await getInboxData();
  const selectedThreadId = params.threadId ?? data.threads[0]?.id;
  const thread = data.threads.find((t) => t.id === selectedThreadId) ?? data.threads[0];
  const messages = data.messages.filter((m) => m.threadId === thread.id);
  const classification = data.classifications.find((c) => c.threadId === thread.id);
  const draft = data.drafts.find((d) => d.threadId === thread.id);
  const load = data.loads.find((l) => l.id === thread.matchedLoadId);

  return (
    <main style={{ display: 'grid', gridTemplateColumns: '340px 1fr 360px', gap: 12, height: '100vh', padding: 12 }}>
      <section style={{ background: '#eef2ff', borderRadius: 12, padding: 12, overflow: 'auto' }}>
        <h3>Email Threads</h3>
        <input placeholder="Search threads" style={{ width: '100%', padding: 8, marginBottom: 8 }} />
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, fontSize: 12 }}><span>Category</span><span>Status</span><span>Priority</span></div>
        <ThreadList threads={data.threads} selectedThreadId={thread.id} />
      </section>

      <section style={{ background: '#fff', borderRadius: 12, padding: 12, overflow: 'auto' }}>
        <h2>{thread.subject}</h2>
        <div>{thread.senderName}</div>
        <hr />
        {messages.map((m) => <div key={m.id} style={{ marginBottom: 10, background: m.isInternal ? '#ecfeff' : '#f9fafb', padding: 10, borderRadius: 8 }}><b>{m.fromName}</b><p>{m.body}</p></div>)}
        <h4>Internal Notes</h4>
        <textarea style={{ width: '100%', minHeight: 80 }} placeholder="Write notes..." />
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button>Generate draft</button><button>Mark resolved</button><button>Escalate</button><button>Create workflow action</button>
        </div>
      </section>

      <section style={{ background: '#f8fafc', borderRadius: 12, padding: 12, overflow: 'auto' }}>
        <h3>Matched Load</h3>
        <div>{load ? `${load.id} • ${load.lane} • ${load.rate}` : 'No matched load'}</div>
        <h3>AI Classification</h3>
        <div>{classification ? `${classification.label} (${classification.confidence})` : 'N/A'}</div>
        <h3>Suggested Reply</h3>
        <p>{draft?.suggestedReply ?? 'No suggestion'}</p>
        <h3>Suggested Next Action</h3>
        <p>{draft?.suggestedAction ?? 'No action suggestion'}</p>
        <h3>Audit Timeline</h3>
        <ul>{data.timeline.map((t) => <li key={t}>{t}</li>)}</ul>
      </section>
    </main>
  );
}
