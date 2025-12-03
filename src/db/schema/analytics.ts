import { relations, sql } from "drizzle-orm";
import { date, index, integer, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { agentSessionStatusEnum } from "./enums";
import { organizations } from "./organizations";
import { users } from "./users";

// Agent Sessions (WebSocket tracking)
export const agentSessions = pgTable(
  "agent_sessions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => sql`gen_random_uuid()::text`),
    agentId: text("agent_id")
      .notNull()
      .references(() => users.id),
    connectionId: text("connection_id").unique().notNull(),
    status: agentSessionStatusEnum("status").default("ONLINE").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("agent_sessions_agent_id_idx").on(table.agentId),
    index("agent_sessions_status_idx").on(table.status),
  ],
);

export const agentSessionsRelations = relations(agentSessions, ({ one }) => ({
  agent: one(users, {
    fields: [agentSessions.agentId],
    references: [users.id],
  }),
}));

// Performance Metrics (Aggregated analytics)
export const performanceMetrics = pgTable(
  "performance_metrics",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => sql`gen_random_uuid()::text`),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    agentId: text("agent_id")
      .notNull()
      .references(() => users.id),
    date: date("date").notNull(),
    totalConversations: integer("total_conversations").default(0).notNull(),
    conversationsAccepted: integer("conversations_accepted").default(0).notNull(),
    conversationsCompleted: integer("conversations_completed").default(0).notNull(),
    totalMessagesSent: integer("total_messages_sent").default(0).notNull(),
    totalMessagesReceived: integer("total_messages_received").default(0).notNull(),
    avgMessageLengthChars: integer("avg_message_length_chars"),
    avgFirstResponseMs: integer("avg_first_response_ms"),
    avgResponseTimeMs: integer("avg_response_time_ms"),
    minResponseTimeMs: integer("min_response_time_ms"),
    maxResponseTimeMs: integer("max_response_time_ms"),
    concurrentPeak: integer("concurrent_peak").default(0).notNull(),
    totalOnlineMinutes: integer("total_online_minutes").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("performance_metrics_agent_date_unique").on(table.agentId, table.date),
    index("performance_metrics_organization_id_idx").on(table.organizationId),
    index("performance_metrics_date_idx").on(table.date),
  ],
);

export const performanceMetricsRelations = relations(performanceMetrics, ({ one }) => ({
  organization: one(organizations, {
    fields: [performanceMetrics.organizationId],
    references: [organizations.id],
  }),
  agent: one(users, {
    fields: [performanceMetrics.agentId],
    references: [users.id],
  }),
}));

export type AgentSession = typeof agentSessions.$inferSelect;
export type NewAgentSession = typeof agentSessions.$inferInsert;
export type PerformanceMetric = typeof performanceMetrics.$inferSelect;
export type NewPerformanceMetric = typeof performanceMetrics.$inferInsert;
