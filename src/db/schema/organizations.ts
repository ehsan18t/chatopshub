import { relations, sql } from "drizzle-orm";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { performanceMetrics } from "./analytics";
import { channels } from "./channels";
import { contacts } from "./contacts";
import { conversations } from "./conversations";
import { users } from "./users";

export const organizations = pgTable("organizations", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => sql`gen_random_uuid()::text`),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  channels: many(channels),
  contacts: many(contacts),
  conversations: many(conversations),
  performanceMetrics: many(performanceMetrics),
}));

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
