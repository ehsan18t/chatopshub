import { relations, sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { conversations } from "./conversations";
import { messageDirectionEnum, messageStatusEnum } from "./enums";
import { users } from "./users";

export const messages = pgTable(
  "messages",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => sql`gen_random_uuid()::text`),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id),
    direction: messageDirectionEnum("direction").notNull(),
    agentId: text("agent_id").references(() => users.id),
    body: text("body"),
    mediaUrl: text("media_url"),
    mediaType: text("media_type"),
    providerMessageId: text("provider_message_id").unique(),
    status: messageStatusEnum("status").default("PENDING").notNull(),
    metadata: jsonb("metadata"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("messages_conversation_id_idx").on(table.conversationId),
    index("messages_agent_id_idx").on(table.agentId),
    index("messages_created_at_idx").on(table.createdAt),
    index("messages_provider_message_id_idx").on(table.providerMessageId),
  ],
);

export const messagesRelations = relations(messages, ({ one, many }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  agent: one(users, {
    fields: [messages.agentId],
    references: [users.id],
  }),
  attachments: many(attachments),
}));

// Attachments (Media files)
export const attachments = pgTable(
  "attachments",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => sql`gen_random_uuid()::text`),
    messageId: text("message_id")
      .notNull()
      .references(() => messages.id),
    fileName: text("file_name").notNull(),
    storagePath: text("storage_path").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: text("size_bytes").notNull(), // Using text to avoid integer overflow
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("attachments_message_id_idx").on(table.messageId)],
);

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  message: one(messages, {
    fields: [attachments.messageId],
    references: [messages.id],
  }),
}));

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type Attachment = typeof attachments.$inferSelect;
export type NewAttachment = typeof attachments.$inferInsert;
