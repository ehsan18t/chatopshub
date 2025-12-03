import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { and, desc, eq, lt } from "drizzle-orm";
import type { ConversationEventsService } from "../conversations/conversation-events.service";
import type { ConversationsService } from "../conversations/conversations.service";
import type { DbService } from "../db/db.service";
import { type Message, messages, type NewMessage } from "../db/schema/index";
import type { CreateMessageDto } from "./dto/index";

export interface CursorPaginatedResult<T> {
  data: T[];
  nextCursor: string | null;
}

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly dbService: DbService,
    private readonly eventsService: ConversationEventsService,
    private readonly conversationsService: ConversationsService,
  ) {}

  async create(
    conversationId: string,
    direction: "INBOUND" | "OUTBOUND",
    dto: CreateMessageDto,
    agentId?: string,
    providerMessageId?: string,
  ): Promise<Message> {
    const newMessage: NewMessage = {
      conversationId,
      direction,
      agentId,
      body: dto.body,
      mediaUrl: dto.mediaUrl,
      mediaType: dto.mediaType,
      providerMessageId,
      status: direction === "INBOUND" ? "DELIVERED" : "PENDING",
    };

    const [message] = await this.dbService.db.insert(messages).values(newMessage).returning();

    // Update conversation last message timestamp
    await this.conversationsService.updateLastMessageAt(conversationId);

    // Create event
    const eventType = direction === "INBOUND" ? "MESSAGE_RECEIVED" : "MESSAGE_SENT";
    await this.eventsService.create(conversationId, eventType, agentId, {
      messageId: message.id,
    });

    // If outbound, set first response time if not already set
    if (direction === "OUTBOUND") {
      await this.conversationsService.setFirstResponseAt(conversationId);
    }

    // If inbound and conversation is completed, reopen it
    if (direction === "INBOUND") {
      await this.conversationsService.reopen(conversationId);
    }

    this.logger.log(`Message created: ${message.id} (${direction})`);
    return message;
  }

  async findById(id: string): Promise<Message | null> {
    const [message] = await this.dbService.db
      .select()
      .from(messages)
      .where(eq(messages.id, id))
      .limit(1);

    return message ?? null;
  }

  async findByIdOrFail(id: string): Promise<Message> {
    const message = await this.findById(id);
    if (!message) {
      throw new NotFoundException("Message not found");
    }
    return message;
  }

  async findByProviderMessageId(providerMessageId: string): Promise<Message | null> {
    const [message] = await this.dbService.db
      .select()
      .from(messages)
      .where(eq(messages.providerMessageId, providerMessageId))
      .limit(1);

    return message ?? null;
  }

  async findByConversation(
    conversationId: string,
    cursor?: string,
    limit = 50,
  ): Promise<CursorPaginatedResult<Message>> {
    let query = this.dbService.db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(limit + 1); // Fetch one extra to check if there's more

    // If cursor provided, filter messages before that cursor
    if (cursor) {
      const cursorMessage = await this.findById(cursor);
      if (cursorMessage) {
        query = this.dbService.db
          .select()
          .from(messages)
          .where(
            and(
              eq(messages.conversationId, conversationId),
              lt(messages.createdAt, cursorMessage.createdAt),
            ),
          )
          .orderBy(desc(messages.createdAt))
          .limit(limit + 1);
      }
    }

    const result = await query;

    // Check if there are more messages
    const hasMore = result.length > limit;
    const data = hasMore ? result.slice(0, limit) : result;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    return {
      data,
      nextCursor,
    };
  }

  async updateStatus(
    id: string,
    status: "SENT" | "DELIVERED" | "READ" | "FAILED",
    errorCode?: string,
    errorMessage?: string,
  ): Promise<Message> {
    const message = await this.findByIdOrFail(id);

    const [updated] = await this.dbService.db
      .update(messages)
      .set({
        status,
        errorCode,
        errorMessage,
      })
      .where(eq(messages.id, id))
      .returning();

    // Create event
    const eventType =
      status === "DELIVERED"
        ? "MESSAGE_DELIVERED"
        : status === "READ"
          ? "MESSAGE_READ"
          : status === "FAILED"
            ? "MESSAGE_FAILED"
            : null;

    if (eventType) {
      await this.eventsService.create(message.conversationId, eventType, undefined, {
        messageId: id,
        errorCode,
        errorMessage,
      });
    }

    this.logger.log(`Message ${id} status updated to ${status}`);
    return updated;
  }

  async markDelivered(providerMessageId: string): Promise<void> {
    const message = await this.findByProviderMessageId(providerMessageId);
    if (message) {
      await this.updateStatus(message.id, "DELIVERED");
    }
  }

  async markRead(providerMessageId: string): Promise<void> {
    const message = await this.findByProviderMessageId(providerMessageId);
    if (message) {
      await this.updateStatus(message.id, "READ");
    }
  }

  async markFailed(
    providerMessageId: string,
    errorCode: string,
    errorMessage: string,
  ): Promise<void> {
    const message = await this.findByProviderMessageId(providerMessageId);
    if (message) {
      await this.updateStatus(message.id, "FAILED", errorCode, errorMessage);
    }
  }
}
