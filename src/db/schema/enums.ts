import { pgEnum } from "drizzle-orm/pg-core";

// User enums
export const userRoleEnum = pgEnum("user_role", ["ADMIN", "AGENT"]);
export const userStatusEnum = pgEnum("user_status", ["ACTIVE", "INACTIVE", "SUSPENDED"]);

// Channel enums
export const channelProviderEnum = pgEnum("channel_provider", ["WHATSAPP", "MESSENGER"]);
export const channelStatusEnum = pgEnum("channel_status", ["ACTIVE", "INACTIVE", "ERROR"]);

// Conversation enums
export const conversationStatusEnum = pgEnum("conversation_status", [
  "PENDING",
  "ASSIGNED",
  "COMPLETED",
]);

// Message enums
export const messageDirectionEnum = pgEnum("message_direction", ["INBOUND", "OUTBOUND"]);
export const messageStatusEnum = pgEnum("message_status", [
  "PENDING",
  "SENT",
  "DELIVERED",
  "READ",
  "FAILED",
]);

// Conversation event types
export const conversationEventTypeEnum = pgEnum("conversation_event_type", [
  "CREATED",
  "ACCEPTED",
  "RELEASED",
  "REASSIGNED",
  "COMPLETED",
  "REOPENED",
  "AGENT_DISCONNECTED",
  "MESSAGE_RECEIVED",
  "MESSAGE_SENT",
  "MESSAGE_DELIVERED",
  "MESSAGE_READ",
  "MESSAGE_FAILED",
]);

// Agent session status
export const agentSessionStatusEnum = pgEnum("agent_session_status", ["ONLINE", "AWAY", "OFFLINE"]);
