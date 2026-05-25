import { Nav } from '@/components/Nav';
import { classifyEmailMock, generateDraftMock } from '@/lib/mock';
import { hasOpenAiKey } from '@/lib/env';

export default function InboxPage() {
  const sample = 'Need rate for Dallas to Atlanta this Friday';
  const mode = hasOpenAiKey() ? 'OPENAI_API_KEY present (real integration pending)' : 'Mock AI fallback active';
  return (
    <main className="container">
      <h1>Inbox</h1>
      <Nav />
      <div className="card"><strong>AI mode:</strong> {mode}</div>
      <div className="card"><strong>Classification:</strong> {classifyEmailMock(sample)}</div>
      <div className="card"><strong>Draft reply:</strong> {generateDraftMock('Dallas → Atlanta')}</div>
    </main>
  );
}
