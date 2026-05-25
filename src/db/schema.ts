import {
  boolean,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

const createdAt = timestamp("created_at", { withTimezone: true }).defaultNow().notNull();

export const userRoleEnum = pgEnum("user_role", ["admin", "agent", "viewer"]);
export const inboxProviderEnum = pgEnum("inbox_provider", ["gmail", "outlook", "imap", "other"]);
export const threadStatusEnum = pgEnum("thread_status", ["open", "pending_review", "drafted", "resolved", "escalated"]);
export const threadPriorityEnum = pgEnum("thread_priority", ["low", "normal", "high", "urgent"]);
export const messageDirectionEnum = pgEnum("message_direction", ["inbound", "outbound"]);
export const draftStatusEnum = pgEnum("draft_status", ["pending", "approved", "rejected", "edited"]);
export const actorTypeEnum = pgEnum("actor_type", ["user", "ai", "system"]);

export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    createdAt,
  },
  (t) => [index("tenants_created_at_idx").on(t.createdAt)],
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    role: userRoleEnum("role").notNull().default("agent"),
    createdAt,
  },
  (t) => [
    index("users_tenant_id_idx").on(t.tenantId),
    index("users_tenant_email_idx").on(t.tenantId, t.email),
  ],
);

export const inboxes = pgTable(
  "inboxes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    emailAddress: text("email_address").notNull(),
    provider: inboxProviderEnum("provider").notNull().default("other"),
    createdAt,
  },
  (t) => [index("inboxes_tenant_id_idx").on(t.tenantId)],
);



export const inboxConnections = pgTable(
  "inbox_connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    inboxId: uuid("inbox_id").notNull().references(() => inboxes.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("connected"),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    createdAt,
  },
  (t) => [
    index("inbox_connections_tenant_id_idx").on(t.tenantId),
    index("inbox_connections_inbox_id_idx").on(t.inboxId),
  ],
);

export const emailThreads = pgTable(
  "email_threads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    inboxId: uuid("inbox_id").notNull().references(() => inboxes.id, { onDelete: "cascade" }),
    subject: text("subject").notNull(),
    customerName: text("customer_name"),
    carrierName: text("carrier_name"),
    status: threadStatusEnum("status").notNull().default("open"),
    priority: threadPriorityEnum("priority").notNull().default("normal"),
    gmailThreadId: text("gmail_thread_id").unique(),
    gmailHistoryId: text("gmail_history_id"),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    createdAt,
  },
  (t) => [
    index("email_threads_tenant_id_idx").on(t.tenantId),
    index("email_threads_inbox_id_idx").on(t.inboxId),
    index("email_threads_last_message_at_idx").on(t.lastMessageAt),
  ],
);

export const emailMessages = pgTable(
  "email_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    threadId: uuid("thread_id").notNull().references(() => emailThreads.id, { onDelete: "cascade" }),
    direction: messageDirectionEnum("direction").notNull(),
    senderName: text("sender_name"),
    senderEmail: text("sender_email").notNull(),
    recipientEmail: text("recipient_email").notNull(),
    subject: text("subject"),
    gmailMessageId: text("gmail_message_id").unique(),
    body: text("body").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    createdAt,
  },
  (t) => [
    index("email_messages_tenant_id_idx").on(t.tenantId),
    index("email_messages_thread_id_idx").on(t.threadId),
    index("email_messages_received_at_idx").on(t.receivedAt),
  ],
);

export const loads = pgTable(
  "loads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    loadNumber: text("load_number").notNull(),
    poNumber: text("po_number"),
    customerName: text("customer_name"),
    carrierName: text("carrier_name"),
    originCity: text("origin_city"),
    originState: text("origin_state"),
    destinationCity: text("destination_city"),
    destinationState: text("destination_state"),
    pickupAt: timestamp("pickup_at", { withTimezone: true }),
    deliveryAt: timestamp("delivery_at", { withTimezone: true }),
    currentStatus: text("current_status"),
    eta: timestamp("eta", { withTimezone: true }),
    driverName: text("driver_name"),
    driverPhone: text("driver_phone"),
    equipmentType: text("equipment_type"),
    rate: numeric("rate", { precision: 12, scale: 2 }),
    internalNotes: text("internal_notes"),
    riskLevel: text("risk_level").default("low"),
    createdAt,
  },
  (t) => [
    index("loads_tenant_id_idx").on(t.tenantId),
    index("loads_load_number_idx").on(t.loadNumber),
    index("loads_po_number_idx").on(t.poNumber),
  ],
);

export const loadDocuments = pgTable(
  "load_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    loadId: uuid("load_id").notNull().references(() => loads.id, { onDelete: "cascade" }),
    documentType: text("document_type").notNull(),
    fileName: text("file_name").notNull(),
    fileUrl: text("file_url").notNull(),
    createdAt,
  },
  (t) => [
    index("load_documents_load_id_idx").on(t.loadId),
  ],
);

export const aiClassifications = pgTable(
  "ai_classifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    messageId: uuid("message_id").notNull().references(() => emailMessages.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    urgency: text("urgency"),
    confidence: numeric("confidence", { precision: 5, scale: 4 }),
    extractedLoadNumber: text("extracted_load_number"),
    extractedPoNumber: text("extracted_po_number"),
    extractedCustomer: text("extracted_customer"),
    extractedCarrier: text("extracted_carrier"),
    extractedLane: text("extracted_lane"),
    suggestedAction: text("suggested_action"),
    reasoning: text("reasoning"),
    createdAt,
  },
  (t) => [
    index("ai_classifications_tenant_id_idx").on(t.tenantId),
    index("ai_classifications_message_id_idx").on(t.messageId),
    index("ai_classifications_category_idx").on(t.category),
  ],
);

export const aiDrafts = pgTable(
  "ai_drafts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    messageId: uuid("message_id").notNull().references(() => emailMessages.id, { onDelete: "cascade" }),
    loadId: uuid("load_id").references(() => loads.id, { onDelete: "set null" }),
    draftSubject: text("draft_subject"),
    draftBody: text("draft_body").notNull(),
    confidence: numeric("confidence", { precision: 5, scale: 4 }),
    approvalRequired: boolean("approval_required").notNull().default(true),
    status: draftStatusEnum("status").notNull().default("pending"),
    createdAt,
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("ai_drafts_tenant_id_idx").on(t.tenantId),
    index("ai_drafts_message_id_idx").on(t.messageId),
  ],
);

export const workflowActions = pgTable(
  "workflow_actions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    threadId: uuid("thread_id").notNull().references(() => emailThreads.id, { onDelete: "cascade" }),
    messageId: uuid("message_id").references(() => emailMessages.id, { onDelete: "set null" }),
    loadId: uuid("load_id").references(() => loads.id, { onDelete: "set null" }),
    actionType: text("action_type").notNull(),
    status: text("status").notNull(),
    assignedTo: uuid("assigned_to").references(() => users.id, { onDelete: "set null" }),
    notes: text("notes"),
    createdAt,
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("workflow_actions_tenant_id_idx").on(t.tenantId),
    index("workflow_actions_thread_id_idx").on(t.threadId),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    actorType: actorTypeEnum("actor_type").notNull(),
    actorName: text("actor_name").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    action: text("action").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt,
  },
  (t) => [
    index("audit_logs_tenant_id_idx").on(t.tenantId),
    index("audit_logs_created_at_idx").on(t.createdAt),
  ],
);

export const sopRules = pgTable(
  "sop_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: text("category").notNull(),
    ruleText: text("rule_text").notNull(),
    requireApproval: boolean("require_approval").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt,
  },
  (t) => [
    index("sop_rules_tenant_id_idx").on(t.tenantId),
    index("sop_rules_category_idx").on(t.category),
  ],
);

// Relations
export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  inboxes: many(inboxes),
  emailThreads: many(emailThreads),
  loads: many(loads),
  sopRules: many(sopRules),
  auditLogs: many(auditLogs),
}));

export const emailThreadsRelations = relations(emailThreads, ({ one, many }) => ({
  tenant: one(tenants, { fields: [emailThreads.tenantId], references: [tenants.id] }),
  inbox: one(inboxes, { fields: [emailThreads.inboxId], references: [inboxes.id] }),
  messages: many(emailMessages),
  workflowActions: many(workflowActions),
}));

export const emailMessagesRelations = relations(emailMessages, ({ one, many }) => ({
  tenant: one(tenants, { fields: [emailMessages.tenantId], references: [tenants.id] }),
  thread: one(emailThreads, { fields: [emailMessages.threadId], references: [emailThreads.id] }),
  classifications: many(aiClassifications),
  drafts: many(aiDrafts),
}));

export const loadsRelations = relations(loads, ({ one, many }) => ({
  tenant: one(tenants, { fields: [loads.tenantId], references: [tenants.id] }),
  documents: many(loadDocuments),
}));
