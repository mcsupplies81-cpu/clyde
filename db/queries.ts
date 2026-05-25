import { desc, eq } from 'drizzle-orm';
import { getDb } from './client';
import { aiClassifications, aiDrafts, emailMessages, emailThreads, loads } from './schema';

export type InboxData = Awaited<ReturnType<typeof getInboxData>>;

const fallback = {
  threads: [
    { id: 't1', subject: 'Need reefer quote DAL → ATL', senderName: 'Maya Lee', category: 'Quote', status: 'Open', priority: 'High', lastMessageAt: new Date('2026-05-25T08:45:00Z'), matchedLoadId: 'L-1022' },
    { id: 't2', subject: 'POD missing for load 8127', senderName: 'Northstar Foods', category: 'Issue', status: 'Pending', priority: 'Medium', lastMessageAt: new Date('2026-05-25T07:20:00Z'), matchedLoadId: 'L-8127' }
  ],
  messages: [
    { id: 'm1', threadId: 't1', fromName: 'Maya Lee', body: 'Can you quote 42k reefer pickup tomorrow morning?', createdAt: new Date('2026-05-25T08:41:00Z'), isInternal: false },
    { id: 'm2', threadId: 't1', fromName: 'Clyde Ops', body: 'Checking capacity and market rate now.', createdAt: new Date('2026-05-25T08:46:00Z'), isInternal: true }
  ],
  loads: [{ id: 'L-1022', lane: 'Dallas, TX → Atlanta, GA', pickupDate: '2026-05-26', equipment: 'Reefer 53\'', rate: '$3,450', status: 'Sourcing' }],
  classifications: [{ id: 'c1', threadId: 't1', label: 'Rate Request', confidence: '0.93', rationale: 'Customer asked for quote and equipment details.' }],
  drafts: [{ id: 'd1', threadId: 't1', suggestedReply: 'Hi Maya — we can cover with a 53\' reefer. Current all-in is $3,450 for a 5/26 pickup.', suggestedAction: 'Confirm pickup window and commodity temp requirements.' }],
  timeline: ['08:41 Customer email received', '08:42 Auto-tagged: Quote/High', '08:46 Internal note added']
};

export async function getInboxData() {
  const db = getDb();
  if (!db) return fallback;

  const threads = await db.select().from(emailThreads).orderBy(desc(emailThreads.lastMessageAt));
  const selectedThreadId = threads[0]?.id;
  const messages = selectedThreadId ? await db.select().from(emailMessages).where(eq(emailMessages.threadId, selectedThreadId)).orderBy(desc(emailMessages.createdAt)) : [];
  const matchedLoadId = threads[0]?.matchedLoadId;
  const matchedLoads = matchedLoadId ? await db.select().from(loads).where(eq(loads.id, matchedLoadId)) : [];
  const classifications = selectedThreadId ? await db.select().from(aiClassifications).where(eq(aiClassifications.threadId, selectedThreadId)) : [];
  const drafts = selectedThreadId ? await db.select().from(aiDrafts).where(eq(aiDrafts.threadId, selectedThreadId)) : [];

  return { threads, messages, loads: matchedLoads, classifications, drafts, timeline: [] as string[] };
}
