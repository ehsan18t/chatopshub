import { relations, sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { conversations } from "./conversations";
import { channelProviderEnum } from "./enums";
import { organizations } from "./organizations";

export const contacts = pgTable(
  "contacts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => sql`gen_random_uuid()::text`),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    providerId: text("provider_id").notNull(),
    provider: channelProviderEnum("provider").notNull(),
    displayName: text("display_name"),
    metadata: jsonb("metadata"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("contacts_org_provider_id_unique").on(
      table.organizationId,
      table.provider,
      table.providerId,
    ),
    index("contacts_organization_id_idx").on(table.organizationId),
    index("contacts_provider_id_idx").on(table.providerId),
  ],
);

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [contacts.organizationId],
    references: [organizations.id],
  }),
  conversations: many(conversations),
}));

export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
