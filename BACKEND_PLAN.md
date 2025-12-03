# Chat OPS Hub — Backend Implementation Plan

> **Repository**: `chatopshub-backend`  
> **Version**: 1.0  
> **Last Updated**: December 2025  
> **Status**: Ready for Implementation

NestJS backend API for the Chat OPS Hub unified social inbox. Handles WhatsApp Business API and Facebook Messenger webhooks, real-time WebSocket events, conversation management, and agent analytics.

---

## Table of Contents

1. [Tech Stack](#1-tech-stack)
2. [Project Structure](#2-project-structure)
3. [Database Schema](#3-database-schema)
4. [Module Implementation](#4-module-implementation)
5. [API Specification](#5-api-specification)
6. [WebSocket Events](#6-websocket-events)
7. [Background Jobs](#7-background-jobs)
8. [Development Setup](#8-development-setup)
9. [Implementation Phases](#9-implementation-phases)

---

## 1. Tech Stack

### Core Technologies

| Technology               | Version | Purpose                                       |
| ------------------------ | ------- | --------------------------------------------- |
| NestJS                   | 11.x    | Modular REST API + WebSocket gateway          |
| Drizzle ORM              | 1.x     | Type-safe database ORM                        |
| postgres                 | 3.x     | PostgreSQL driver (porsager/postgres)         |
| PostgreSQL               | 18.x    | Primary data store                            |
| Valkey                   | 9.x     | Distributed locks, pub/sub, cache             |
| iovalkey                 | 0.3.x   | Valkey client (ioredis fork)                  |
| BullMQ                   | 5.x     | Background job processing                     |
| Socket.io                | 4.7.x   | Real-time WebSocket with fallback             |
| better-auth              | 1.x     | Authentication (sessions in Valkey)           |
| nestjs-better-auth       | 0.x     | NestJS adapter (@thallesp/nestjs-better-auth) |
| @node-rs/argon2          | 2.x     | Password hashing (Rust-based)                 |
| class-validator          | 0.14.x  | DTO validation                                |
| @nestjs/axios            | 3.x     | External API calls                            |
| @socket.io/redis-adapter | 8.x     | Multi-instance WebSocket scaling              |

### Development Tools

| Tool                    | Purpose                   |
| ----------------------- | ------------------------- |
| Docker + Docker Compose | PostgreSQL, Valkey, App   |
| Bun                     | Package manager + runtime |
| Biome                   | Linting + formatting      |
| ngrok                   | Webhook tunnel for dev    |
| TypeScript              | Type safety (strict mode) |
| Drizzle Studio          | Database GUI              |
| @nestjs/swagger         | OpenAPI documentation     |

### External Integrations

| Service            | API                            |
| ------------------ | ------------------------------ |
| WhatsApp Business  | Cloud API (Meta)               |
| Facebook Messenger | Graph API / Messenger Platform |
| File Storage       | Local filesystem               |

---

## 2. Project Structure

```
chatopshub-backend/
├── src/
│   ├── main.ts                      # Application entry point
│   ├── app.module.ts                # Root module
│   │
│   ├── common/                      # Shared utilities
│   │   ├── decorators/
│   │   │   ├── current-user.decorator.ts
│   │   │   └── roles.decorator.ts
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts
│   │   │   └── roles.guard.ts
│   │   ├── interceptors/
│   │   │   └── logging.interceptor.ts
│   │   └── pipes/
│   │       └── validation.pipe.ts
│   │
│   ├── config/                      # Configuration
│   │   ├── config.module.ts
│   │   ├── configuration.ts
│   │   └── validation.schema.ts
│   │
│   ├── db/                          # Drizzle ORM
│   │   ├── db.module.ts
│   │   ├── db.service.ts
│   │   ├── migrate.ts               # Migration runner
│   │   └── schema/                  # Split by domain
│   │       ├── index.ts             # Re-exports all schemas
│   │       ├── organizations.ts
│   │       ├── users.ts
│   │       ├── channels.ts
│   │       ├── contacts.ts
│   │       ├── conversations.ts
│   │       ├── messages.ts
│   │       ├── analytics.ts
│   │       └── enums.ts             # Shared enum definitions
│   │
│   ├── valkey/                      # Valkey client (iovalkey)
│   │   ├── valkey.module.ts
│   │   └── valkey.service.ts
│   │
│   ├── auth/                        # Authentication (better-auth)
│   │   ├── auth.ts                  # better-auth instance configuration
│   │   ├── auth.service.ts          # Password hashing utilities
│   │   └── dto/
│   │       └── auth-response.dto.ts
│   │
│   ├── users/                       # User management
│   │   ├── users.module.ts
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   └── dto/
│   │       ├── create-user.dto.ts
│   │       └── update-user.dto.ts
│   │
│   ├── channels/                    # Channel configuration
│   │   ├── channels.module.ts
│   │   ├── channels.controller.ts
│   │   ├── channels.service.ts
│   │   └── dto/
│   │       ├── create-channel.dto.ts
│   │       └── update-channel.dto.ts
│   │
│   ├── contacts/                    # Customer contacts
│   │   ├── contacts.module.ts
│   │   ├── contacts.service.ts
│   │   └── dto/
│   │       └── contact.dto.ts
│   │
│   ├── conversations/               # Conversation management
│   │   ├── conversations.module.ts
│   │   ├── conversations.controller.ts
│   │   ├── conversations.service.ts
│   │   ├── conversation-events.service.ts
│   │   └── dto/
│   │       ├── conversation-query.dto.ts
│   │       └── conversation-response.dto.ts
│   │
│   ├── messages/                    # Message handling
│   │   ├── messages.module.ts
│   │   ├── messages.controller.ts
│   │   ├── messages.service.ts
│   │   └── dto/
│   │       ├── create-message.dto.ts
│   │       └── message-response.dto.ts
│   │
│   ├── webhooks/                    # External webhooks
│   │   ├── webhooks.module.ts
│   │   ├── webhooks.controller.ts
│   │   ├── handlers/
│   │   │   ├── whatsapp.handler.ts
│   │   │   └── messenger.handler.ts
│   │   ├── validators/
│   │   │   └── signature.validator.ts
│   │   └── dto/
│   │       ├── whatsapp-webhook.dto.ts
│   │       └── messenger-webhook.dto.ts
│   │
│   ├── providers/                   # External API clients
│   │   ├── providers.module.ts
│   │   ├── whatsapp/
│   │   │   ├── whatsapp.service.ts
│   │   │   └── whatsapp.types.ts
│   │   └── messenger/
│   │       ├── messenger.service.ts
│   │       └── messenger.types.ts
│   │
│   ├── events/                      # WebSocket gateway
│   │   ├── events.module.ts
│   │   ├── events.gateway.ts
│   │   └── events.service.ts
│   │
│   ├── queues/                      # Background jobs
│   │   ├── queues.module.ts
│   │   └── processors/
│   │       ├── outbound-message.processor.ts
│   │       ├── webhook.processor.ts
│   │       └── analytics.processor.ts
│   │
│   ├── analytics/                   # Performance metrics
│   │   ├── analytics.module.ts
│   │   ├── analytics.controller.ts
│   │   ├── analytics.service.ts
│   │   └── dto/
│   │       └── analytics-query.dto.ts
│   │
│   └── storage/                     # File storage
│       ├── storage.module.ts
│       └── storage.service.ts
│
├── drizzle/
│   ├── migrations/                  # SQL migration files
│   └── meta/                        # Migration metadata
│
├── scripts/
│   └── seed.ts                      # Database seeding
│
├── test/
│   ├── app.e2e-spec.ts
│   └── jest-e2e.json
│
├── docker-compose.yml               # PostgreSQL, Valkey, App
├── Dockerfile
├── .env.example
├── biome.json                       # Biome linter/formatter config
├── drizzle.config.ts                # Drizzle Kit configuration
├── package.json
├── tsconfig.json
├── nest-cli.json
└── README.md
```

---

## 3. Database Schema

> Schema files are split by domain in `src/db/schema/`. Uses Drizzle ORM with `postgres` driver (porsager/postgres).

### 3.1 Drizzle Configuration (`drizzle.config.ts`)

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
```

### 3.2 Database Service (`src/db/db.service.ts`)

```typescript
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

@Injectable()
export class DbService implements OnModuleInit, OnModuleDestroy {
  private client: postgres.Sql;
  public db: PostgresJsDatabase<typeof schema>;

  async onModuleInit() {
    this.client = postgres(process.env.DATABASE_URL!, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });
    this.db = drizzle(this.client, { schema });
  }

  async onModuleDestroy() {
    await this.client.end();
  }
}
```

### 3.3 Shared Enums (`src/db/schema/enums.ts`)

```typescript
import { pgEnum } from 'drizzle-orm/pg-core';

// User enums
export const userRoleEnum = pgEnum('user_role', ['ADMIN', 'AGENT']);
export const userStatusEnum = pgEnum('user_status', ['ACTIVE', 'INACTIVE', 'SUSPENDED']);

// Channel enums
export const channelProviderEnum = pgEnum('channel_provider', ['WHATSAPP', 'MESSENGER']);
export const channelStatusEnum = pgEnum('channel_status', ['ACTIVE', 'INACTIVE', 'ERROR']);

// Conversation enums
export const conversationStatusEnum = pgEnum('conversation_status', ['PENDING', 'ASSIGNED', 'COMPLETED']);

// Message enums
export const messageDirectionEnum = pgEnum('message_direction', ['INBOUND', 'OUTBOUND']);
export const messageStatusEnum = pgEnum('message_status', ['PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED']);

// Conversation event types
export const conversationEventTypeEnum = pgEnum('conversation_event_type', [
  'CREATED',
  'ACCEPTED',
  'RELEASED',
  'REASSIGNED',
  'COMPLETED',
  'REOPENED',
  'AGENT_DISCONNECTED',
  'MESSAGE_RECEIVED',
  'MESSAGE_SENT',
  'MESSAGE_DELIVERED',
  'MESSAGE_READ',
  'MESSAGE_FAILED',
]);

// Agent session status
export const agentSessionStatusEnum = pgEnum('agent_session_status', ['ONLINE', 'AWAY', 'OFFLINE']);
```

### 3.4 Organizations Schema (`src/db/schema/organizations.ts`)

```typescript
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { users } from './users';
import { channels } from './channels';
import { contacts } from './contacts';
import { conversations } from './conversations';
import { performanceMetrics } from './analytics';

export const organizations = pgTable('organizations', {
  id: text('id').primaryKey().$defaultFn(() => sql`gen_random_uuid()::text`),
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
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
```

### 3.5 Users Schema (`src/db/schema/users.ts`)

```typescript
import { pgTable, text, timestamp, index, unique } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { userRoleEnum, userStatusEnum } from './enums';
import { organizations } from './organizations';
import { conversations } from './conversations';
import { messages } from './messages';
import { conversationEvents } from './conversations';
import { agentSessions, performanceMetrics } from './analytics';

export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => sql`gen_random_uuid()::text`),
  organizationId: text('organization_id').notNull().references(() => organizations.id),
  email: text('email').notNull(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  role: userRoleEnum('role').default('AGENT').notNull(),
  status: userStatusEnum('status').default('ACTIVE').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  unique('users_org_email_unique').on(table.organizationId, table.email),
  index('users_organization_id_idx').on(table.organizationId),
  index('users_status_idx').on(table.status),
]);

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
```

### 3.6 Channels Schema (`src/db/schema/channels.ts`)

```typescript
import { pgTable, text, timestamp, index, jsonb } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { channelProviderEnum, channelStatusEnum } from './enums';
import { organizations } from './organizations';
import { conversations } from './conversations';

export const channels = pgTable('channels', {
  id: text('id').primaryKey().$defaultFn(() => sql`gen_random_uuid()::text`),
  organizationId: text('organization_id').notNull().references(() => organizations.id),
  provider: channelProviderEnum('provider').notNull(),
  name: text('name').notNull(),
  config: jsonb('config').notNull(), // { phoneNumberId, accessToken, pageId, etc. }
  webhookSecret: text('webhook_secret'),
  status: channelStatusEnum('status').default('ACTIVE').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index('channels_organization_id_idx').on(table.organizationId),
  index('channels_provider_idx').on(table.provider),
]);

export const channelsRelations = relations(channels, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [channels.organizationId],
    references: [organizations.id],
  }),
  conversations: many(conversations),
}));

export type Channel = typeof channels.$inferSelect;
export type NewChannel = typeof channels.$inferInsert;
```

### 3.7 Contacts Schema (`src/db/schema/contacts.ts`)

```typescript
import { pgTable, text, timestamp, index, unique, jsonb } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { channelProviderEnum } from './enums';
import { organizations } from './organizations';
import { conversations } from './conversations';

export const contacts = pgTable('contacts', {
  id: text('id').primaryKey().$defaultFn(() => sql`gen_random_uuid()::text`),
  organizationId: text('organization_id').notNull().references(() => organizations.id),
  providerId: text('provider_id').notNull(),
  provider: channelProviderEnum('provider').notNull(),
  displayName: text('display_name'),
  metadata: jsonb('metadata'),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).defaultNow().notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique('contacts_org_provider_id_unique').on(table.organizationId, table.provider, table.providerId),
  index('contacts_organization_id_idx').on(table.organizationId),
  index('contacts_provider_id_idx').on(table.providerId),
]);

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [contacts.organizationId],
    references: [organizations.id],
  }),
  conversations: many(conversations),
}));

export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
```

### 3.8 Conversations Schema (`src/db/schema/conversations.ts`)

```typescript
import { pgTable, text, timestamp, index, jsonb } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { conversationStatusEnum, conversationEventTypeEnum } from './enums';
import { organizations } from './organizations';
import { channels } from './channels';
import { contacts } from './contacts';
import { users } from './users';
import { messages } from './messages';

export const conversations = pgTable('conversations', {
  id: text('id').primaryKey().$defaultFn(() => sql`gen_random_uuid()::text`),
  organizationId: text('organization_id').notNull().references(() => organizations.id),
  channelId: text('channel_id').notNull().references(() => channels.id),
  contactId: text('contact_id').notNull().references(() => contacts.id),
  status: conversationStatusEnum('status').default('PENDING').notNull(),
  assignedAgentId: text('assigned_agent_id').references(() => users.id),
  lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
  firstResponseAt: timestamp('first_response_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index('conversations_organization_id_idx').on(table.organizationId),
  index('conversations_status_idx').on(table.status),
  index('conversations_assigned_agent_id_idx').on(table.assignedAgentId),
  index('conversations_channel_id_idx').on(table.channelId),
  index('conversations_last_message_at_idx').on(table.lastMessageAt),
]);

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
export const conversationEvents = pgTable('conversation_events', {
  id: text('id').primaryKey().$defaultFn(() => sql`gen_random_uuid()::text`),
  conversationId: text('conversation_id').notNull().references(() => conversations.id),
  eventType: conversationEventTypeEnum('event_type').notNull(),
  actorId: text('actor_id').references(() => users.id),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('conversation_events_conversation_id_idx').on(table.conversationId),
  index('conversation_events_event_type_idx').on(table.eventType),
  index('conversation_events_created_at_idx').on(table.createdAt),
]);

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
```

### 3.9 Messages Schema (`src/db/schema/messages.ts`)

```typescript
import { pgTable, text, timestamp, index, jsonb } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { messageDirectionEnum, messageStatusEnum } from './enums';
import { conversations } from './conversations';
import { users } from './users';

export const messages = pgTable('messages', {
  id: text('id').primaryKey().$defaultFn(() => sql`gen_random_uuid()::text`),
  conversationId: text('conversation_id').notNull().references(() => conversations.id),
  direction: messageDirectionEnum('direction').notNull(),
  agentId: text('agent_id').references(() => users.id),
  body: text('body'),
  mediaUrl: text('media_url'),
  mediaType: text('media_type'),
  providerMessageId: text('provider_message_id').unique(),
  status: messageStatusEnum('status').default('PENDING').notNull(),
  metadata: jsonb('metadata'),
  errorCode: text('error_code'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index('messages_conversation_id_idx').on(table.conversationId),
  index('messages_agent_id_idx').on(table.agentId),
  index('messages_created_at_idx').on(table.createdAt),
  index('messages_provider_message_id_idx').on(table.providerMessageId),
]);

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
export const attachments = pgTable('attachments', {
  id: text('id').primaryKey().$defaultFn(() => sql`gen_random_uuid()::text`),
  messageId: text('message_id').notNull().references(() => messages.id),
  fileName: text('file_name').notNull(),
  storagePath: text('storage_path').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: text('size_bytes').notNull(), // Using text to avoid integer overflow
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('attachments_message_id_idx').on(table.messageId),
]);

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
```

### 3.10 Analytics Schema (`src/db/schema/analytics.ts`)

```typescript
import { pgTable, text, timestamp, integer, date, index, unique } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { agentSessionStatusEnum } from './enums';
import { organizations } from './organizations';
import { users } from './users';

// Agent Sessions (WebSocket tracking)
export const agentSessions = pgTable('agent_sessions', {
  id: text('id').primaryKey().$defaultFn(() => sql`gen_random_uuid()::text`),
  agentId: text('agent_id').notNull().references(() => users.id),
  connectionId: text('connection_id').unique().notNull(),
  status: agentSessionStatusEnum('status').default('ONLINE').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('agent_sessions_agent_id_idx').on(table.agentId),
  index('agent_sessions_status_idx').on(table.status),
]);

export const agentSessionsRelations = relations(agentSessions, ({ one }) => ({
  agent: one(users, {
    fields: [agentSessions.agentId],
    references: [users.id],
  }),
}));

// Performance Metrics (Aggregated analytics)
export const performanceMetrics = pgTable('performance_metrics', {
  id: text('id').primaryKey().$defaultFn(() => sql`gen_random_uuid()::text`),
  organizationId: text('organization_id').notNull().references(() => organizations.id),
  agentId: text('agent_id').notNull().references(() => users.id),
  date: date('date').notNull(),
  totalConversations: integer('total_conversations').default(0).notNull(),
  conversationsAccepted: integer('conversations_accepted').default(0).notNull(),
  conversationsCompleted: integer('conversations_completed').default(0).notNull(),
  totalMessagesSent: integer('total_messages_sent').default(0).notNull(),
  totalMessagesReceived: integer('total_messages_received').default(0).notNull(),
  avgMessageLengthChars: integer('avg_message_length_chars'),
  avgFirstResponseMs: integer('avg_first_response_ms'),
  avgResponseTimeMs: integer('avg_response_time_ms'),
  minResponseTimeMs: integer('min_response_time_ms'),
  maxResponseTimeMs: integer('max_response_time_ms'),
  concurrentPeak: integer('concurrent_peak').default(0).notNull(),
  totalOnlineMinutes: integer('total_online_minutes').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  unique('performance_metrics_agent_date_unique').on(table.agentId, table.date),
  index('performance_metrics_organization_id_idx').on(table.organizationId),
  index('performance_metrics_date_idx').on(table.date),
]);

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
```

### 3.11 Schema Index (`src/db/schema/index.ts`)

```typescript
// Re-export all schemas
export * from './enums';
export * from './organizations';
export * from './users';
export * from './channels';
export * from './contacts';
export * from './conversations';
export * from './messages';
export * from './analytics';
```

### 3.12 Migration Commands

```bash
# Generate migration from schema changes
bun drizzle-kit generate

# Apply migrations
bun drizzle-kit migrate

# Open Drizzle Studio
bun drizzle-kit studio

# Push schema directly (dev only, no migration)
bun drizzle-kit push
```

---

## 4. Module Implementation

### 4.1 Module Structure

```
AppModule
├── ConfigModule (global)
├── DbModule (global)             # Drizzle + postgres
├── ValkeyModule (global)         # iovalkey client
├── AuthModule                    # better-auth + Valkey sessions
├── UsersModule
├── ChannelsModule
├── ContactsModule
├── ConversationsModule
├── MessagesModule
├── WebhooksModule
├── ProvidersModule
├── EventsModule (WebSocket)
├── QueuesModule (BullMQ)
├── AnalyticsModule
└── StorageModule
```

### 4.2 Valkey Module (`src/valkey/valkey.service.ts`)

```typescript
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'iovalkey';

@Injectable()
export class ValkeyService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    this.client = new Redis(this.configService.get('VALKEY_URL'), {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 50, 2000),
      lazyConnect: false,
    });
    
    this.client.on('error', (err) => {
      console.error('Valkey connection error:', err);
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  getClient(): Redis {
    return this.client;
  }

  // Lock helpers for distributed operations
  async acquireLock(key: string, ttlMs: number, value: string = 'locked'): Promise<boolean> {
    const result = await this.client.set(key, value, 'PX', ttlMs, 'NX');
    return result === 'OK';
  }

  async releaseLock(key: string): Promise<void> {
    await this.client.del(key);
  }

  // Session storage helpers (for better-auth)
  async setSession(sessionId: string, data: object, ttlSeconds: number): Promise<void> {
    await this.client.setex(`session:${sessionId}`, ttlSeconds, JSON.stringify(data));
  }

  async getSession(sessionId: string): Promise<object | null> {
    const data = await this.client.get(`session:${sessionId}`);
    return data ? JSON.parse(data) : null;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.client.del(`session:${sessionId}`);
  }

  // Pub/Sub for WebSocket broadcasting
  async publish(channel: string, message: object): Promise<void> {
    await this.client.publish(channel, JSON.stringify(message));
  }

  createSubscriber(): Redis {
    return this.client.duplicate();
  }
}
```

### 4.3 Auth Module with better-auth (`src/auth/auth.ts`)

Using the official NestJS adapter `@thallesp/nestjs-better-auth`:

```typescript
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { hash, verify } from '@node-rs/argon2';
import { db } from '../db/db.service';
import * as schema from '../db/schema';

// Argon2 configuration (OWASP recommended)
const ARGON2_OPTIONS = {
  memoryCost: 19456,  // 19 MiB
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
};

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
  }),
  
  baseURL: process.env.AUTH_URL,
  secret: process.env.AUTH_SECRET,
  
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update session every 24 hours
  },
  
  emailAndPassword: {
    enabled: true,
    
    async hashPassword(password: string): Promise<string> {
      return await hash(password, ARGON2_OPTIONS);
    },
    
    async verifyPassword(hashedPassword: string, password: string): Promise<boolean> {
      return await verify(hashedPassword, password);
    },
  },
  
  advanced: {
    generateId: () => crypto.randomUUID(),
  },
});

export type Auth = typeof auth;
```

### 4.4 App Module Integration (`src/app.module.ts`)

```typescript
import { Module } from '@nestjs/common';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { auth } from './auth/auth';
import { DbModule } from './db/db.module';
import { ValkeyModule } from './valkey/valkey.module';
// ... other imports

@Module({
  imports: [
    AuthModule.forRoot({ auth }),  // Global auth with automatic guard
    DbModule,
    ValkeyModule,
    // ... other modules
  ],
})
export class AppModule {}
```

### 4.5 Main.ts Configuration

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,  // Required for better-auth to handle raw request body
  });
  
  app.enableCors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  });
  
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
```

### 4.6 Using Auth in Controllers

```typescript
import { Controller, Get } from '@nestjs/common';
import { Session, UserSession, AllowAnonymous } from '@thallesp/nestjs-better-auth';

@Controller('users')
export class UsersController {
  @Get('me')
  async getProfile(@Session() session: UserSession) {
    return { user: session.user };
  }

  @Get('public')
  @AllowAnonymous()  // Bypass global auth guard
  async getPublicData() {
    return { message: 'Public endpoint' };
  }
}
```
```

### 4.7 Auth Service Utilities (`src/auth/auth.service.ts`)

```typescript
import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

// Argon2 configuration (OWASP recommended)
const ARGON2_OPTIONS = {
  memoryCost: 19456,  // 19 MiB
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
};

@Injectable()
export class AuthUtilsService {
  async hashPassword(password: string): Promise<string> {
    return await hash(password, ARGON2_OPTIONS);
  }

  async verifyPassword(hashedPassword: string, password: string): Promise<boolean> {
    return await verify(hashedPassword, password);
  }
}
```

### 4.8 Key Services & Their Responsibilities

#### Auth (via @thallesp/nestjs-better-auth)
```typescript
// Global guard automatically protects all routes
// Use decorators for access control:
@Session() session: UserSession     // Get current session
@AllowAnonymous()                   // Public route
@OptionalAuth()                     // Auth optional
```

#### UsersService
```typescript
class UsersService {
  create(dto: CreateUserDto): Promise<User>
  findById(id: string): Promise<User>
  findByEmail(organizationId: string, email: string): Promise<User | null>
  update(id: string, dto: UpdateUserDto): Promise<User>
  updateStatus(id: string, status: UserStatus): Promise<User>
}
```

#### ChannelsService
```typescript
class ChannelsService {
  create(dto: CreateChannelDto): Promise<Channel>
  findAll(organizationId: string): Promise<Channel[]>
  findById(id: string): Promise<Channel>
  update(id: string, dto: UpdateChannelDto): Promise<Channel>
  testConnection(id: string): Promise<{ success: boolean; message: string }>
}
```

#### ContactsService
```typescript
class ContactsService {
  upsert(organizationId: string, provider: ChannelProvider, providerId: string, displayName?: string): Promise<Contact>
  findByProviderId(organizationId: string, provider: ChannelProvider, providerId: string): Promise<Contact | null>
  updateLastSeen(id: string): Promise<void>
}
```

#### ConversationsService
```typescript
class ConversationsService {
  findOrCreate(channelId: string, contactId: string): Promise<Conversation>
  findAll(organizationId: string, filters: ConversationQueryDto): Promise<PaginatedResult<Conversation>>
  findById(id: string): Promise<ConversationWithDetails>
  accept(conversationId: string, agentId: string): Promise<Conversation>
  release(conversationId: string, agentId: string): Promise<Conversation>
  complete(conversationId: string, agentId: string): Promise<Conversation>
  reopen(conversationId: string): Promise<Conversation>
  getAssignedCount(agentId: string): Promise<number>
}
```

#### ConversationEventsService
```typescript
class ConversationEventsService {
  create(conversationId: string, eventType: ConversationEventType, actorId?: string, metadata?: object): Promise<ConversationEvent>
  findByConversation(conversationId: string, pagination: PaginationDto): Promise<PaginatedResult<ConversationEvent>>
}
```

#### MessagesService
```typescript
class MessagesService {
  create(conversationId: string, dto: CreateMessageDto): Promise<Message>
  findByConversation(conversationId: string, pagination: CursorPaginationDto): Promise<CursorPaginatedResult<Message>>
  updateStatus(id: string, status: MessageStatus): Promise<Message>
  markDelivered(providerMessageId: string): Promise<void>
  markRead(providerMessageId: string): Promise<void>
}
```

#### WhatsAppService
```typescript
class WhatsAppService {
  sendTextMessage(phoneNumber: string, text: string, phoneNumberId: string, accessToken: string): Promise<string>
  sendMediaMessage(phoneNumber: string, mediaUrl: string, type: string, phoneNumberId: string, accessToken: string): Promise<string>
  markAsRead(messageId: string, phoneNumberId: string, accessToken: string): Promise<void>
  downloadMedia(mediaId: string, accessToken: string): Promise<Buffer>
}
```

#### MessengerService
```typescript
class MessengerService {
  sendTextMessage(psid: string, text: string, pageAccessToken: string): Promise<string>
  sendMediaMessage(psid: string, mediaUrl: string, type: string, pageAccessToken: string): Promise<string>
  setTypingIndicator(psid: string, on: boolean, pageAccessToken: string): Promise<void>
}
```

#### EventsGateway (WebSocket with Multi-Instance Support)
```typescript
@WebSocketGateway({ cors: true })
class EventsGateway implements OnGatewayInit {
  afterInit(server: Server): void  // Configure redis-adapter for scaling
  handleConnection(client: Socket): Promise<void>
  handleDisconnect(client: Socket): Promise<void>
  @SubscribeMessage('heartbeat')
  handleHeartbeat(client: Socket): void
  @SubscribeMessage('join:conversation')
  handleJoinConversation(client: Socket, conversationId: string): void
  @SubscribeMessage('leave:conversation')
  handleLeaveConversation(client: Socket, conversationId: string): void
  
  // Broadcast methods (work across all instances via Valkey Pub/Sub)
  broadcastToOrganization(orgId: string, event: string, data: any): void
  broadcastToConversation(convId: string, event: string, data: any): void
  notifyAgent(agentId: string, event: string, data: any): void
}
```

#### WebSocket Scaling Setup (`src/events/events.gateway.ts`)
```typescript
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'iovalkey';

@WebSocketGateway({ cors: true })
export class EventsGateway implements OnGatewayInit {
  constructor(private valkeyService: ValkeyService) {}

  afterInit(server: Server) {
    // Enable multi-instance broadcasting via Valkey Pub/Sub
    const pubClient = this.valkeyService.getClient();
    const subClient = pubClient.duplicate();
    server.adapter(createAdapter(pubClient, subClient));
  }
}
```

#### AnalyticsService
```typescript
class AnalyticsService {
  getAgentMetrics(agentId: string, dateRange: DateRangeDto): Promise<AgentMetricsResponse>
  getOrganizationMetrics(organizationId: string, dateRange: DateRangeDto): Promise<OrgMetricsResponse>
  calculateFirstResponseTime(conversationId: string): Promise<number | null>
  aggregateDailyMetrics(agentId: string, date: Date): Promise<PerformanceMetric>
}
```

### 4.9 Distributed Locking Pattern (Conversation Accept)

```typescript
// ConversationsService.accept()
async accept(conversationId: string, agentId: string): Promise<Conversation> {
  const lockKey = `lock:conversation:${conversationId}`;
  const lockTTL = 5000; // 5 seconds
  
  // Acquire Valkey lock
  const acquired = await this.valkeyService.acquireLock(lockKey, lockTTL, agentId);
  if (!acquired) {
    throw new ConflictException('Conversation is being processed by another agent');
  }
  
  try {
    // Double-check status in transaction
    const result = await this.dbService.db.transaction(async (tx) => {
      const [conversation] = await tx
        .select()
        .from(conversations)
        .where(eq(conversations.id, conversationId))
        .for('update');
      
      if (!conversation) {
        throw new NotFoundException('Conversation not found');
      }
      
      if (conversation.status !== 'PENDING') {
        throw new ConflictException('Conversation is not available for assignment');
      }
      
      // Update conversation
      const [updated] = await tx
        .update(conversations)
        .set({
          status: 'ASSIGNED',
          assignedAgentId: agentId,
        })
        .where(eq(conversations.id, conversationId))
        .returning();
      
      // Record event
      await tx.insert(conversationEvents).values({
        conversationId,
        eventType: 'ACCEPTED',
        actorId: agentId,
      });
      
      return updated;
    });
    
    // Fetch with relations for response
    const conversationWithRelations = await this.dbService.db.query.conversations.findFirst({
      where: eq(conversations.id, conversationId),
      with: {
        contact: true,
        channel: true,
        assignedAgent: true,
      },
    });
    
    // Broadcast update via WebSocket
    this.eventsGateway.broadcastConversationUpdate(conversationWithRelations);
    
    return conversationWithRelations;
  } finally {
    // Always release lock
    await this.valkeyService.releaseLock(lockKey);
  }
}
```

### 4.10 Webhook Processing Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     WEBHOOK CONTROLLER                          │
├─────────────────────────────────────────────────────────────────┤
│ 1. Receive POST /api/webhooks/whatsapp                         │
│ 2. Validate X-Hub-Signature-256 (HMAC SHA256)                  │
│ 3. Return 200 OK immediately                                   │
│ 4. Enqueue job to 'webhook-processing' queue                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   WEBHOOK PROCESSOR (BullMQ)                    │
├─────────────────────────────────────────────────────────────────┤
│ 1. Parse and normalize message                                 │
│ 2. Check idempotency (providerMessageId unique)                │
│ 3. Upsert contact                                              │
│ 4. Find or create conversation                                 │
│ 5. Create message record                                       │
│ 6. Create conversation event                                   │
│ 7. If conversation was COMPLETED → reopen to PENDING           │
│ 8. Broadcast via WebSocket                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. API Specification

### 5.1 Authentication

```
POST /api/auth/login
Body: { email: string, password: string }
Response: { 
  accessToken: string, 
  refreshToken: string,
  user: { id, name, email, role, organizationId }
}

POST /api/auth/refresh
Body: { refreshToken: string }
Response: { accessToken: string }

POST /api/auth/logout
Headers: Authorization: Bearer <token>
Body: { refreshToken: string }
Response: { success: true }

GET /api/auth/me
Headers: Authorization: Bearer <token>
Response: { id, name, email, role, organizationId }
```

### 5.2 Conversations

```
GET /api/conversations
Query: ?status=PENDING|ASSIGNED|COMPLETED&channelId=xxx&search=xxx&page=1&limit=20
Response: { 
  data: Conversation[], 
  meta: { total, page, limit, totalPages } 
}

GET /api/conversations/:id
Response: { 
  ...conversation, 
  contact: Contact,
  channel: Channel,
  messages: Message[] (latest 50)
}

POST /api/conversations/:id/accept
Response: { ...updatedConversation }
Error: 409 Conflict if already assigned

POST /api/conversations/:id/release
Response: { ...updatedConversation }
Error: 403 Forbidden if not assigned to current user

POST /api/conversations/:id/complete
Response: { ...updatedConversation }

GET /api/conversations/:id/events
Query: ?page=1&limit=50
Response: { data: ConversationEvent[], meta }
```

### 5.3 Messages

```
GET /api/conversations/:id/messages
Query: ?cursor=xxx&limit=50 (cursor-based pagination)
Response: { data: Message[], nextCursor: string|null }

POST /api/conversations/:id/messages
Body: { body?: string, mediaUrl?: string, mediaType?: string }
Response: { ...message, status: 'PENDING' }
```

### 5.4 Webhooks

```
GET /api/webhooks/whatsapp
Query: hub.mode, hub.verify_token, hub.challenge
Response: hub.challenge (plain text)

POST /api/webhooks/whatsapp
Headers: X-Hub-Signature-256
Body: WhatsApp webhook payload
Response: 200 OK (no body)

GET /api/webhooks/messenger
Query: hub.mode, hub.verify_token, hub.challenge
Response: hub.challenge (plain text)

POST /api/webhooks/messenger
Headers: X-Hub-Signature
Body: Messenger webhook payload
Response: 200 OK (no body)
```

### 5.5 Analytics

```
GET /api/analytics/agents/:agentId
Query: ?startDate=2025-01-01&endDate=2025-01-31
Response: {
  summary: {
    totalConversations: number,
    avgFirstResponseMs: number,
    avgResponseTimeMs: number,
    totalMessagesSent: number,
  },
  daily: PerformanceMetric[]
}

GET /api/analytics/organization
Query: ?startDate=2025-01-01&endDate=2025-01-31
Response: {
  summary: { ... },
  byAgent: AgentMetricsSummary[],
  daily: DailyMetric[]
}
```

### 5.6 Channels (Admin)

```
GET /api/channels
Response: { data: Channel[] }

POST /api/channels
Body: { provider, name, config }
Response: { ...channel }

PATCH /api/channels/:id
Body: { name?, config?, status? }
Response: { ...channel }

POST /api/channels/:id/test
Response: { success: boolean, message: string }
```

### 5.7 Users (Admin)

```
GET /api/users
Query: ?role=AGENT|ADMIN&status=ACTIVE
Response: { data: User[] }

POST /api/users
Body: { email, password, name, role }
Response: { ...user }

PATCH /api/users/:id
Body: { name?, role?, status? }
Response: { ...user }
```

---

## 6. WebSocket Events

### 6.1 Gateway Structure

```
Namespace: / (default)
├── Room: org:{organizationId}     → All agents in org
├── Room: agent:{agentId}          → Direct to specific agent
└── Room: conversation:{convId}    → Agents viewing conversation
```

### 6.2 Server → Client Events

#### conversation.created
Emitted when a new conversation is created (new inbound message from unknown contact).

```typescript
interface ConversationCreatedPayload {
  id: string;
  organizationId: string;
  channelId: string;
  contactId: string;
  status: 'PENDING';
  lastMessageAt: string;
  createdAt: string;
  contact: {
    id: string;
    providerId: string;
    displayName: string | null;
    provider: 'WHATSAPP' | 'MESSENGER';
  };
  channel: {
    id: string;
    name: string;
    provider: 'WHATSAPP' | 'MESSENGER';
  };
}
```

#### conversation.updated
Emitted when conversation status or assignment changes.

```typescript
interface ConversationUpdatedPayload {
  id: string;
  status: 'PENDING' | 'ASSIGNED' | 'COMPLETED';
  assignedAgentId: string | null;
  lastMessageAt: string;
  updatedAt: string;
  contact: {
    id: string;
    displayName: string | null;
  };
  assignedAgent?: {
    id: string;
    name: string;
  };
}
```

#### message.created
Emitted when a new message arrives (inbound) or is sent (outbound).

```typescript
interface MessageCreatedPayload {
  id: string;
  conversationId: string;
  direction: 'INBOUND' | 'OUTBOUND';
  agentId: string | null;
  body: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  createdAt: string;
}
```

#### message.updated
Emitted when message delivery status changes.

```typescript
interface MessageUpdatedPayload {
  id: string;
  conversationId: string;
  status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  errorCode?: string;
  errorMessage?: string;
  updatedAt: string;
}
```

#### assignment.changed
Emitted when conversation is accepted, released, or reassigned.

```typescript
interface AssignmentChangedPayload {
  conversationId: string;
  status: 'PENDING' | 'ASSIGNED' | 'COMPLETED';
  assignedAgentId: string | null;
  previousAgentId: string | null;
  eventType: 'ACCEPTED' | 'RELEASED' | 'REASSIGNED' | 'AGENT_DISCONNECTED';
}
```

#### agent.presence
Emitted when an agent's online status changes.

```typescript
interface AgentPresencePayload {
  agentId: string;
  status: 'ONLINE' | 'AWAY' | 'OFFLINE';
  lastSeenAt: string;
}
```

### 6.3 Client → Server Events

#### heartbeat
Keep-alive ping sent by client every 30 seconds.

```typescript
// Client sends
socket.emit('heartbeat');

// Server updates lastSeenAt for agent session
```

#### join:conversation
Client requests to join a conversation room for real-time updates.

```typescript
interface JoinConversationPayload {
  conversationId: string;
}

// Client sends
socket.emit('join:conversation', { conversationId: 'conv_123' });
```

#### leave:conversation
Client leaves a conversation room.

```typescript
interface LeaveConversationPayload {
  conversationId: string;
}

// Client sends
socket.emit('leave:conversation', { conversationId: 'conv_123' });
```

### 6.4 Connection Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     CLIENT CONNECTS                             │
├─────────────────────────────────────────────────────────────────┤
│ const socket = io(BACKEND_URL, {                               │
│   auth: { token: accessToken },                                │
│   transports: ['websocket', 'polling'],                        │
│ });                                                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SERVER: handleConnection()                  │
├─────────────────────────────────────────────────────────────────┤
│ 1. Validate JWT from auth.token                                │
│ 2. Create/update AgentSession record                           │
│ 3. Join room: org:{organizationId}                             │
│ 4. Join room: agent:{agentId}                                  │
│ 5. Broadcast agent.presence { status: 'ONLINE' }               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SERVER: handleDisconnect()                  │
├─────────────────────────────────────────────────────────────────┤
│ 1. Mark AgentSession offline                                   │
│ 2. Start grace period timer (30 seconds)                       │
│ 3. If no reconnect:                                            │
│    - Release assigned conversations                            │
│    - Broadcast conversation.updated for each                   │
│    - Broadcast agent.presence { status: 'OFFLINE' }            │
└─────────────────────────────────────────────────────────────────┘
```

### 6.5 Event Flow Diagram

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Agent A    │     │   Backend    │     │   Agent B    │
│   Browser    │     │   Server     │     │   Browser    │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       │  connect (JWT)     │                    │
       │───────────────────>│                    │
       │                    │  join org room     │
       │                    │<───────────────────│
       │                    │                    │
       │                    │◄─── Webhook ───────│ (WhatsApp)
       │                    │    (new message)   │
       │                    │                    │
       │  conversation.     │  conversation.     │
       │  created           │  created           │
       │<───────────────────│───────────────────>│
       │                    │                    │
       │  REST: accept      │                    │
       │───────────────────>│                    │
       │                    │                    │
       │  assignment.       │  assignment.       │
       │  changed           │  changed           │
       │<───────────────────│───────────────────>│
       │                    │                    │
       │  join:conversation │                    │
       │───────────────────>│                    │
       │                    │                    │
       │  REST: send msg    │                    │
       │───────────────────>│                    │
       │                    │                    │
       │  message.created   │                    │
       │<───────────────────│                    │
       │                    │                    │
       │                    │◄── Delivery ack ───│ (WhatsApp)
       │                    │                    │
       │  message.updated   │                    │
       │  (DELIVERED)       │                    │
       │<───────────────────│                    │
       │                    │                    │
```

---

## 7. Background Jobs

### 7.1 Queue Definitions

```typescript
// queues.module.ts
BullModule.registerQueue(
  { name: 'webhook-processing' },
  { name: 'outbound-messages' },
  { name: 'analytics-aggregation' },
  { name: 'media-processing' },
  { name: 'cleanup' },
);
```

### 7.2 Job Types

#### webhook-processing
- **Job**: Process incoming webhook payload
- **Data**: `{ provider, payload, channelId, receivedAt }`
- **Retry**: 3 attempts, exponential backoff
- **Timeout**: 30 seconds

#### outbound-messages
- **Job**: Send message to WhatsApp/Messenger
- **Data**: `{ messageId, conversationId, provider, ... }`
- **Retry**: 3 attempts with backoff
- **Rate limit**: 80/second (WhatsApp), 200/second (Messenger)
- **On success**: Update message status, create event, broadcast
- **On failure**: Update message with error, create event, broadcast

#### analytics-aggregation
- **Job**: Compute daily metrics for agent
- **Data**: `{ agentId, date }`
- **Schedule**: Daily at 00:05 UTC
- **Retry**: 2 attempts

#### media-processing
- **Job**: Download and store media from providers
- **Data**: `{ messageId, mediaId, provider, accessToken }`
- **Retry**: 3 attempts
- **On success**: Update message.mediaUrl to local path

#### cleanup
- **Job**: Clean up old data
- **Schedule**: Daily at 03:00 UTC
- **Tasks**: Delete old sessions, expired tokens

---

## 8. Development Setup

### 8.1 Prerequisites

- Bun 1.2+ (package manager + runtime)
- Docker & Docker Compose

### 8.2 Docker Compose Configuration

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:18-alpine
    container_name: chatops-postgres
    environment:
      POSTGRES_USER: chatops
      POSTGRES_PASSWORD: chatops_dev
      POSTGRES_DB: chatopshub
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U chatops"]
      interval: 5s
      timeout: 5s
      retries: 5

  valkey:
    image: valkey/valkey:9-alpine
    container_name: chatops-valkey
    ports:
      - "6379:6379"
    volumes:
      - valkey_data:/data
    healthcheck:
      test: ["CMD", "valkey-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: chatops-backend
    ports:
      - "3001:3001"
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://chatops:chatops_dev@postgres:5432/chatopshub
      VALKEY_URL: redis://valkey:6379
      AUTH_SECRET: dev-auth-secret-change-in-production
    depends_on:
      postgres:
        condition: service_healthy
      valkey:
        condition: service_healthy
    volumes:
      - .:/app
      - /app/node_modules
    command: bun run start:dev

volumes:
  postgres_data:
  valkey_data:
```

### 8.3 Dockerfile

```dockerfile
FROM oven/bun:1.2-alpine

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source
COPY . .

# Build
RUN bun run build

EXPOSE 3001

CMD ["bun", "run", "start:prod"]
```

### 8.4 Biome Configuration (`biome.json`)

```json
{
  "$schema": "https://biomejs.dev/schemas/2.0.0/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": {
        "noUnusedImports": "error",
        "noUnusedVariables": "error"
      },
      "style": {
        "useConst": "error",
        "noNonNullAssertion": "warn"
      },
      "suspicious": {
        "noExplicitAny": "warn"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "semicolons": "always",
      "trailingCommas": "all"
    }
  }
}
```

### 8.5 Environment Variables

```bash
# .env.example

# Database (PostgreSQL 18)
DATABASE_URL=postgresql://chatops:chatops_dev@localhost:5432/chatopshub

# Valkey 9
VALKEY_URL=redis://localhost:6379

# better-auth
AUTH_SECRET=your-super-secret-auth-key-change-in-production
AUTH_URL=http://localhost:3001

# WhatsApp Business API
WHATSAPP_VERIFY_TOKEN=your-webhook-verify-token
WHATSAPP_APP_SECRET=your-app-secret-for-signature-validation

# Facebook Messenger
MESSENGER_VERIFY_TOKEN=your-messenger-verify-token
MESSENGER_APP_SECRET=your-messenger-app-secret

# Storage
STORAGE_TYPE=local
STORAGE_PATH=./uploads

# Server
PORT=3001
```

### 8.6 Quick Start Commands

```bash
# Clone repository
git clone <repo-url> chatopshub-backend
cd chatopshub-backend

# Install dependencies
bun install

# Start infrastructure (PostgreSQL + Valkey)
docker-compose up -d postgres valkey

# Copy environment file
cp .env.example .env

# Generate and run database migrations
bun drizzle-kit generate
bun drizzle-kit migrate

# Seed initial data (organization, admin user)
bun run scripts/seed.ts

# Start development server
bun run start:dev

# Access
# API: http://localhost:3001
# Swagger: http://localhost:3001/api/docs
# Drizzle Studio: bun drizzle-kit studio (port 4983)
```

### 8.7 Webhook Tunnel Setup (ngrok)

For local WhatsApp/Messenger webhook testing:

```bash
# Install ngrok globally
bun add -g ngrok

# Authenticate (one-time, get token from https://dashboard.ngrok.com)
ngrok config add-authtoken <your-token>

# Start tunnel to local backend
ngrok http 3001

# You'll get a URL like: https://abc123.ngrok-free.app
# Use this for webhook configuration in Meta Developer Console
```

**Configure webhooks in Meta Developer Console:**
- WhatsApp: `https://abc123.ngrok-free.app/api/webhooks/whatsapp`
- Messenger: `https://abc123.ngrok-free.app/api/webhooks/messenger`

> **Tip:** ngrok free tier changes URL on restart. For stable URLs, use ngrok paid plan or Cloudflare Tunnel.

### 8.8 Seed Script (`scripts/seed.ts`)

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { hash } from '@node-rs/argon2';
import { organizations, users } from '../src/db/schema';
import { eq } from 'drizzle-orm';

const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
};

async function main() {
  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle(client);

  console.log('Seeding database...');

  // Create organization
  const [org] = await db
    .insert(organizations)
    .values({
      name: 'Default Organization',
      slug: 'default',
    })
    .onConflictDoNothing({ target: organizations.slug })
    .returning();

  const orgId = org?.id ?? (
    await db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, 'default'))
      .limit(1)
  )[0].id;

  // Create admin user
  const passwordHash = await hash('admin123', ARGON2_OPTIONS);
  await db
    .insert(users)
    .values({
      organizationId: orgId,
      email: 'admin@chatopshub.local',
      passwordHash,
      name: 'Admin User',
      role: 'ADMIN',
      status: 'ACTIVE',
    })
    .onConflictDoNothing();

  console.log('Seed completed!');
  console.log('Admin credentials: admin@chatopshub.local / admin123');

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

### 8.9 Package.json Scripts

```json
{
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "start:prod": "bun dist/main.js",
    "lint": "biome lint .",
    "lint:fix": "biome lint --write .",
    "format": "biome format --write .",
    "check": "biome check --write .",
    "test": "bun test",
    "test:watch": "bun test --watch",
    "test:cov": "bun test --coverage",
    "test:e2e": "bun test test/*.e2e-spec.ts",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "db:seed": "bun run scripts/seed.ts"
  }
}
```

---

## 9. Implementation Phases

### Phase A: Foundation & Core

#### A.1 Project Setup
- [ ] Initialize NestJS project with TypeScript strict mode
- [ ] Set up `docker-compose.yml` with PostgreSQL 18 and Valkey 9
- [ ] Configure Biome (biome.json)
- [ ] Create `.env.example` with all variables
- [ ] Set up `@nestjs/swagger` for API documentation
- [ ] Initialize bun.lock with `bun install`

#### A.2 Database & ORM
- [ ] Create Drizzle schema files (split by domain in src/db/schema/)
- [ ] Create `drizzle.config.ts`
- [ ] Create `DbModule` and `DbService` with postgres driver
- [ ] Generate initial migration with `bun drizzle-kit generate`
- [ ] Create seed script (`scripts/seed.ts`) with @node-rs/argon2
- [ ] Set up Drizzle Studio access

#### A.3 Configuration & Common
- [ ] Implement `ConfigModule` with validation schema
- [ ] Create `@CurrentUser()` decorator
- [ ] Create `@Roles()` decorator
- [ ] Create `AuthGuard` (for better-auth sessions)
- [ ] Create `RolesGuard`
- [ ] Create global exception filter
- [ ] Create logging interceptor

#### A.4 Authentication (better-auth)
- [ ] Create `ValkeyModule` and `ValkeyService` with iovalkey
- [ ] Create `src/auth/auth.ts` with better-auth configuration
- [ ] Install and configure `@thallesp/nestjs-better-auth`
- [ ] Disable body parser in `main.ts`
- [ ] Import `AuthModule.forRoot({ auth })` in `app.module.ts`
- [ ] Create `AuthUtilsService` with @node-rs/argon2 helpers
- [ ] Test global auth guard with `@AllowAnonymous()` decorator

#### A.5 Users Module
- [ ] Implement `UsersService` with Drizzle queries
- [ ] Create `UsersController` with endpoints
- [ ] Add admin-only guards
- [ ] Create DTOs with class-validator

#### A.6 Channels Module
- [ ] Implement `ChannelsService`
- [ ] Create `ChannelsController`
- [ ] Add test connection endpoint
- [ ] Create DTOs

#### A.7 Contacts Module
- [ ] Implement `ContactsService` with upsert (Drizzle onConflict)
- [ ] Create DTOs

### Phase B: Core Messaging

#### B.1 Valkey Module Enhancement
- [ ] Add distributed lock helpers
- [ ] Add pub/sub helpers for WebSocket
- [ ] Set up connection pooling

#### B.2 Conversations Module
- [ ] Implement `ConversationsService` with Drizzle
- [ ] Implement Valkey distributed locking for accept
- [ ] Create `ConversationEventsService`
- [ ] Implement accept/release/complete flows
- [ ] Handle conversation reopen
- [ ] Create `ConversationsController`

#### B.3 Messages Module
- [ ] Implement `MessagesService`
- [ ] Create outbound message endpoint
- [ ] Implement cursor-based pagination
- [ ] Create DTOs

#### B.4 Webhooks Module
- [ ] Create `WebhooksController` with verification
- [ ] Implement HMAC signature validation
- [ ] Create WhatsApp handler/normalizer
- [ ] Create Messenger handler/normalizer
- [ ] Create webhook DTOs

#### B.5 Providers Module
- [ ] Implement `WhatsAppService` for sending (using @nestjs/axios)
- [ ] Implement `MessengerService` for sending
- [ ] Add rate limiting helpers

### Phase C: Real-time & Background Jobs

#### C.1 WebSocket Gateway
- [ ] Set up Socket.io with NestJS
- [ ] Configure `@socket.io/redis-adapter` with iovalkey for multi-instance scaling
- [ ] Implement session validation from better-auth
- [ ] Create room management (org, agent, conversation)
- [ ] Implement all broadcast methods (work across instances via Valkey Pub/Sub)
- [ ] Handle connection/disconnect events
- [ ] Implement heartbeat mechanism

#### C.2 Queues Module
- [ ] Set up BullMQ with iovalkey connection
- [ ] Implement `WebhookProcessor`
- [ ] Implement `OutboundMessageProcessor`
- [ ] Implement `AnalyticsProcessor`
- [ ] Implement `MediaProcessor`
- [ ] Implement `CleanupProcessor`

#### C.3 Agent Disconnect Handling
- [ ] Implement grace period for disconnects
- [ ] Auto-release conversations after timeout
- [ ] Create `AgentSession` management

### Phase D: Analytics & Polish

#### D.1 Analytics Module
- [ ] Create analytics queries with Drizzle
- [ ] Implement `AnalyticsService`
- [ ] Create analytics endpoints
- [ ] Set up daily aggregation job

#### D.2 Storage Module
- [ ] Implement local file storage
- [ ] Create media download job
- [ ] Handle upload endpoints

#### D.3 Testing
- [ ] Unit tests for services (bun test)
- [ ] Integration tests for webhooks
- [ ] E2E tests for auth and conversations

#### D.4 Documentation
- [ ] Complete Swagger documentation
- [ ] Webhook setup guide
- [ ] README with setup instructions

---

## Appendix A: WhatsApp Webhook Payload

```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "BUSINESS_ACCOUNT_ID",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "15551234567",
          "phone_number_id": "PHONE_NUMBER_ID"
        },
        "contacts": [{
          "profile": { "name": "John Doe" },
          "wa_id": "15559876543"
        }],
        "messages": [{
          "from": "15559876543",
          "id": "wamid.xxx",
          "timestamp": "1699999999",
          "type": "text",
          "text": { "body": "Hello, I need help!" }
        }]
      },
      "field": "messages"
    }]
  }]
}
```

## Appendix B: Messenger Webhook Payload

```json
{
  "object": "page",
  "entry": [{
    "id": "PAGE_ID",
    "time": 1699999999999,
    "messaging": [{
      "sender": { "id": "PSID" },
      "recipient": { "id": "PAGE_ID" },
      "timestamp": 1699999999999,
      "message": {
        "mid": "m_xxx",
        "text": "Hello, I need help!"
      }
    }]
  }]
}
```

---

**End of Backend Implementation Plan**
