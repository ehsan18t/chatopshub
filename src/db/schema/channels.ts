import { relations, sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { conversations } from "./conversations";
import { channelProviderEnum, channelStatusEnum } from "./enums";
import { organizations } from "./organizations";

export const channels = pgTable(
  "channels",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => sql`gen_random_uuid()::text`),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    provider: channelProviderEnum("provider").notNull(),
    name: text("name").notNull(),
    config: jsonb("config").notNull(), // { phoneNumberId, accessToken, pageId, etc. }
    webhookSecret: text("webhook_secret"),
    status: channelStatusEnum("status").default("ACTIVE").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("channels_organization_id_idx").on(table.organizationId),
    index("channels_provider_idx").on(table.provider),
  ],
);

export const channelsRelations = relations(channels, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [channels.organizationId],
    references: [organizations.id],
  }),
  conversations: many(conversations),
}));

export type Channel = typeof channels.$inferSelect;
export type NewChannel = typeof channels.$inferInsert;
