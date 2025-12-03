import { Injectable, Logger } from "@nestjs/common";
import { desc, eq } from "drizzle-orm";
import type { DbService } from "@/db/db.service";
import {
  type ConversationEvent,
  conversationEvents,
  type NewConversationEvent,
} from "@/db/schema/index";

export type ConversationEventType =
  | "CREATED"
  | "ACCEPTED"
  | "RELEASED"
  | "REASSIGNED"
  | "COMPLETED"
  | "REOPENED"
  | "AGENT_DISCONNECTED"
  | "MESSAGE_RECEIVED"
  | "MESSAGE_SENT"
  | "MESSAGE_DELIVERED"
  | "MESSAGE_READ"
  | "MESSAGE_FAILED";

@Injectable()
export class ConversationEventsService {
  private readonly logger = new Logger(ConversationEventsService.name);

  constructor(private readonly dbService: DbService) {}

  async create(
    conversationId: string,
    eventType: ConversationEventType,
    actorId?: string,
    metadata?: Record<string, unknown>,
  ): Promise<ConversationEvent> {
    const newEvent: NewConversationEvent = {
      conversationId,
      eventType,
      actorId,
      metadata,
    };

    const [event] = await this.dbService.db.insert(conversationEvents).values(newEvent).returning();

    this.logger.debug(`Event created: ${eventType} for conversation ${conversationId}`);
    return event;
  }

  async findByConversation(
    conversationId: string,
    page = 1,
    limit = 50,
  ): Promise<{ data: ConversationEvent[]; total: number }> {
    const offset = (page - 1) * limit;

    const [events, countResult] = await Promise.all([
      this.dbService.db
        .select()
        .from(conversationEvents)
        .where(eq(conversationEvents.conversationId, conversationId))
        .orderBy(desc(conversationEvents.createdAt))
        .limit(limit)
        .offset(offset),
      this.dbService.db
        .select()
        .from(conversationEvents)
        .where(eq(conversationEvents.conversationId, conversationId)),
    ]);

    return {
      data: events,
      total: countResult.length,
    };
  }

  async findLatestByType(
    conversationId: string,
    _eventType: ConversationEventType,
  ): Promise<ConversationEvent | null> {
    const [event] = await this.dbService.db
      .select()
      .from(conversationEvents)
      .where(eq(conversationEvents.conversationId, conversationId))
      .orderBy(desc(conversationEvents.createdAt))
      .limit(1);

    return event ?? null;
  }
}
