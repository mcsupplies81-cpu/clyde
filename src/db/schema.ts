import {
  boolean,
  index,
  integer,
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
export const threadStatusEnum = pgEnum("thread_status", ["open", "pending_review", "drafted", "sent", "resolved", "escalated"]);
export const threadPriorityEnum = pgEnum("thread_priority", ["low", "normal", "high", "urgent"]);
export const messageDirectionEnum = pgEnum("message_direction", ["inbound", "outbound"]);
export const draftStatusEnum = pgEnum("draft_status", ["pending", "approved", "rejected", "edited", "sent"]);
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
    clerkUserId: text("clerk_user_id").unique(),
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
    provider: text("provider").notNull().default("gmail"),
    gmailEmail: text("gmail_email").notNull(),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token").notNull(),
    tokenExpiry: timestamp("token_expiry", { withTimezone: true }).notNull(),
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
    reopenedAt: timestamp("reopened_at", { withTimezone: true }),
    reopenCount: numeric("reopen_count", { precision: 10, scale: 0 }).notNull().default("0"),
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

export const emailAttachments = pgTable(
  "email_attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    messageId: uuid("message_id").notNull().references(() => emailMessages.id, { onDelete: "cascade" }),
    loadDocumentId: uuid("load_document_id"),        // set if successfully linked to a load
    documentType: text("document_type").notNull(),   // POD, BOL, Rate Confirmation, etc.
    fileName: text("file_name").notNull(),
    fileUrl: text("file_url"),                        // Vercel Blob URL (null if storage not configured)
    contentType: text("content_type"),
    fileSizeBytes: integer("file_size_bytes"),
    createdAt,
  },
  (t) => [
    index("email_attachments_message_id_idx").on(t.messageId),
    index("email_attachments_tenant_id_idx").on(t.tenantId),
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
    extractedEntities: jsonb("extracted_entities").$type<Record<string, string | null | undefined>>(),
    isFollowUp: boolean("is_follow_up").notNull().default(false),
    followUpType: text("follow_up_type"),
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
    approvedBy: text("approved_by"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    sentBy: text("sent_by"),
    gmailSentMessageId: text("gmail_sent_message_id"),
    finalBody: text("final_body"),
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

export const autopilotSettings = pgTable(
  "autopilot_settings",
  {
    tenantId: uuid("tenant_id").primaryKey().references(() => tenants.id, { onDelete: "cascade" }),
    isEnabled: boolean("is_enabled").notNull().default(false),
    scheduledHour: integer("scheduled_hour").notNull().default(2),
    timezone: text("timezone").notNull().default("UTC"),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    lastRunResult: jsonb("last_run_result").$type<Record<string, unknown>>(),
  },
  (t) => [index("autopilot_settings_enabled_idx").on(t.isEnabled)],
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

// ─── API Keys (for TMS / CRM integrations) ──────────────────────────────────
// Key shown once at creation; only the SHA-256 hash is stored.
export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    keyHash: text("key_hash").notNull().unique(),
    keyPrefix: text("key_prefix").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt,
  },
  (t) => [index("api_keys_tenant_id_idx").on(t.tenantId)],
);

// ─── Risk Rules ──────────────────────────────────────────────────────────────
// Tenant-configurable rules that auto-assign risk level to loads.
// Rules are evaluated in priority order; first match wins.
export const riskRuleTypeEnum = pgEnum("risk_rule_type", ["customer", "rate_threshold", "equipment", "lane"]);
export const riskLevelEnum    = pgEnum("risk_level_enum", ["low", "medium", "high", "critical"]);

export const riskRules = pgTable(
  "risk_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    ruleType: riskRuleTypeEnum("rule_type").notNull(),
    // Flexible match values — interpretation depends on ruleType:
    // customer: matchValue = customer name substring
    // rate_threshold: matchValue = minimum rate (e.g. "3000"), operator = "gte" | "lte"
    // equipment: matchValue = equipment type substring (e.g. "Reefer")
    // lane: matchValue = origin or destination state abbreviation (e.g. "TX")
    matchValue: text("match_value").notNull(),
    operator: text("operator").default("contains"), // "contains" | "gte" | "lte" | "eq"
    riskLevel: text("risk_level").notNull().default("high"), // low | medium | high | critical
    label: text("label").notNull(), // human-readable label, e.g. "Acme Foods — always hot"
    isActive: boolean("is_active").notNull().default(true),
    priority: integer("priority").notNull().default(0), // lower = higher priority
    createdAt,
  },
  (t) => [index("risk_rules_tenant_id_idx").on(t.tenantId)],
);

// ─── Chase Follow-ups ────────────────────────────────────────────────────────
export const chaseFollowUpStatusEnum = pgEnum("chase_follow_up_status", ["active", "completed", "cancelled"]);

export const chaseFollowUps = pgTable(
  "chase_follow_ups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    loadId: uuid("load_id").notNull().references(() => loads.id, { onDelete: "cascade" }),
    docTypes: text("doc_types").notNull(), // comma-separated: "BOL,POD"
    carrierEmail: text("carrier_email").notNull(),
    messageTemplate: text("message_template").notNull(),
    sendCount: integer("send_count").notNull().default(0),
    maxSends: integer("max_sends").notNull().default(3),
    intervalDays: integer("interval_days").notNull().default(2),
    nextSendAt: timestamp("next_send_at", { withTimezone: true }).notNull(),
    status: chaseFollowUpStatusEnum("status").notNull().default("active"),
    createdAt,
  },
  (t) => [
    index("chase_follow_ups_tenant_id_idx").on(t.tenantId),
    index("chase_follow_ups_load_id_idx").on(t.loadId),
    index("chase_follow_ups_status_next_idx").on(t.status, t.nextSendAt),
  ],
);

// Relations
export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  inboxes: many(inboxes),
  emailThreads: many(emailThreads),
  loads: many(loads),
  sopRules: many(sopRules),
  apiKeys: many(apiKeys),
  autopilotSettings: many(autopilotSettings),
  auditLogs: many(auditLogs),
  inboxConnections: many(inboxConnections),
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
  attachments: many(emailAttachments),
}));

export const emailAttachmentsRelations = relations(emailAttachments, ({ one }) => ({
  tenant: one(tenants, { fields: [emailAttachments.tenantId], references: [tenants.id] }),
  message: one(emailMessages, { fields: [emailAttachments.messageId], references: [emailMessages.id] }),
}));

export const loadsRelations = relations(loads, ({ one, many }) => ({
  tenant: one(tenants, { fields: [loads.tenantId], references: [tenants.id] }),
  documents: many(loadDocuments),
}));


export const inboxConnectionsRelations = relations(inboxConnections, ({ one }) => ({
  tenant: one(tenants, { fields: [inboxConnections.tenantId], references: [tenants.id] }),
  inbox: one(inboxes, { fields: [inboxConnections.inboxId], references: [inboxes.id] }),
}));

export const autopilotSettingsRelations = relations(autopilotSettings, ({ one }) => ({
  tenant: one(tenants, { fields: [autopilotSettings.tenantId], references: [tenants.id] }),
}));
