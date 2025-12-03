import { relations, sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { channels } from "./channels";
import { contacts } from "./contacts";
import { conversationEventTypeEnum, conversationStatusEnum } from "./enums";
import { messages } from "./messages";
import { organizations } from "./organizations";
import { users } from "./users";

export const conversations = pgTable(
  "conversations",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => sql`gen_random_uuid()::text`),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id),
    contactId: text("contact_id")
      .notNull()
      .references(() => contacts.id),
    status: conversationStatusEnum("status").default("PENDING").notNull(),
    assignedAgentId: text("assigned_agent_id").references(() => users.id),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    firstResponseAt: timestamp("first_response_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("conversations_organization_id_idx").on(table.organizationId),
    index("conversations_status_idx").on(table.status),
    index("conversations_assigned_agent_id_idx").on(table.assignedAgentId),
    index("conversations_channel_id_idx").on(table.channelId),
    index("conversations_last_message_at_idx").on(table.lastMessageAt),
  ],
);

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [conversations.organizationId],
    references: [organizations.id],
  }),
  channel: one(channels, {
    fields: [conversations.channelId],
    references: [channels.id],
  }),
  contact: one(contacts, {
    fields: [conversations.contactId],
    references: [contacts.id],
  }),
  assignedAgent: one(users, {
    fields: [conversations.assignedAgentId],
    references: [users.id],
  }),
  messages: many(messages),
  events: many(conversationEvents),
}));

// Conversation Events (Audit Trail)
export const conversationEvents = pgTable(
  "conversation_events",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => sql`gen_random_uuid()::text`),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id),
    eventType: conversationEventTypeEnum("event_type").notNull(),
    actorId: text("actor_id").references(() => users.id),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("conversation_events_conversation_id_idx").on(table.conversationId),
    index("conversation_events_event_type_idx").on(table.eventType),
    index("conversation_events_created_at_idx").on(table.createdAt),
  ],
);

export const conversationEventsRelations = relations(conversationEvents, ({ one }) => ({
  conversation: one(conversations, {
    fields: [conversationEvents.conversationId],
    references: [conversations.id],
  }),
  actor: one(users, {
    fields: [conversationEvents.actorId],
    references: [users.id],
  }),
}));

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type ConversationEvent = typeof conversationEvents.$inferSelect;
export type NewConversationEvent = typeof conversationEvents.$inferInsert;
