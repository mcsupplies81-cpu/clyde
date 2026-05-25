import { pgTable, text, timestamp, boolean } from 'drizzle-orm/pg-core';

export const emailThreads = pgTable('email_threads', {
  id: text('id').primaryKey(),
  subject: text('subject').notNull(),
  senderName: text('sender_name').notNull(),
  category: text('category').notNull(),
  status: text('status').notNull(),
  priority: text('priority').notNull(),
  lastMessageAt: timestamp('last_message_at', { withTimezone: true }).notNull(),
  matchedLoadId: text('matched_load_id')
});

export const emailMessages = pgTable('email_messages', {
  id: text('id').primaryKey(),
  threadId: text('thread_id').notNull(),
  fromName: text('from_name').notNull(),
  body: text('body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  isInternal: boolean('is_internal').notNull().default(false)
});

export const loads = pgTable('loads', {
  id: text('id').primaryKey(),
  lane: text('lane').notNull(),
  pickupDate: text('pickup_date').notNull(),
  equipment: text('equipment').notNull(),
  rate: text('rate').notNull(),
  status: text('status').notNull()
});

export const aiClassifications = pgTable('ai_classifications', {
  id: text('id').primaryKey(),
  threadId: text('thread_id').notNull(),
  label: text('label').notNull(),
  confidence: text('confidence').notNull(),
  rationale: text('rationale').notNull()
});

export const aiDrafts = pgTable('ai_drafts', {
  id: text('id').primaryKey(),
  threadId: text('thread_id').notNull(),
  suggestedReply: text('suggested_reply').notNull(),
  suggestedAction: text('suggested_action').notNull()
});
