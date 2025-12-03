import { relations, sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { agentSessions, performanceMetrics } from "./analytics";
import { conversationEvents, conversations } from "./conversations";
import { userRoleEnum, userStatusEnum } from "./enums";
import { messages } from "./messages";
import { organizations } from "./organizations";

export const users = pgTable(
  "users",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => sql`gen_random_uuid()::text`),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    name: text("name").notNull(),
    avatarUrl: text("avatar_url"),
    role: userRoleEnum("role").default("AGENT").notNull(),
    status: userStatusEnum("status").default("ACTIVE").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("users_org_email_unique").on(table.organizationId, table.email),
    index("users_organization_id_idx").on(table.organizationId),
    index("users_status_idx").on(table.status),
  ],
);

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
  assignedConversations: many(conversations),
  sentMessages: many(messages),
  conversationEvents: many(conversationEvents),
  agentSessions: many(agentSessions),
  performanceMetrics: many(performanceMetrics),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
