import { pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const loads = pgTable('loads', {
  id: uuid('id').defaultRandom().primaryKey(),
  loadNumber: varchar('load_number', { length: 64 }).notNull().unique(),
  origin: text('origin').notNull(),
  destination: text('destination').notNull(),
  status: varchar('status', { length: 32 }).notNull(),
  pickupAt: timestamp('pickup_at', { withTimezone: true }).notNull(),
  deliveryAt: timestamp('delivery_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const emails = pgTable('emails', {
  id: uuid('id').defaultRandom().primaryKey(),
  subject: text('subject').notNull(),
  from: text('from_email').notNull(),
  body: text('body').notNull(),
  classification: varchar('classification', { length: 32 }).notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow().notNull(),
});

export const emailLoadMatches = pgTable('email_load_matches', {
  id: uuid('id').defaultRandom().primaryKey(),
  emailId: uuid('email_id').references(() => emails.id).notNull(),
  loadId: uuid('load_id').references(() => loads.id).notNull(),
  confidence: varchar('confidence', { length: 10 }).notNull(),
  method: varchar('method', { length: 32 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const draftReplies = pgTable('draft_replies', {
  id: uuid('id').defaultRandom().primaryKey(),
  emailId: uuid('email_id').references(() => emails.id).notNull(),
  text: text('text').notNull(),
  model: varchar('model', { length: 128 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  actor: varchar('actor', { length: 64 }).notNull(),
  action: varchar('action', { length: 64 }).notNull(),
  entityType: varchar('entity_type', { length: 64 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  payload: text('payload').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
