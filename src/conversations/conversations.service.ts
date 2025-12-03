import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { and, desc, eq, sql } from "drizzle-orm";
import type { DbService } from "@/db/db.service";
import {
  type Conversation,
  type channels,
  type contacts,
  conversations,
  type NewConversation,
  type users,
} from "@/db/schema/index";
import type { ValkeyService } from "@/valkey/valkey.service";
import type { ConversationEventsService } from "./conversation-events.service";
import type { ConversationQueryDto } from "./dto/index";

export interface ConversationWithRelations extends Conversation {
  contact: typeof contacts.$inferSelect;
  channel: typeof channels.$inferSelect;
  assignedAgent: typeof users.$inferSelect | null;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(
    private readonly dbService: DbService,
    private readonly valkeyService: ValkeyService,
    private readonly eventsService: ConversationEventsService,
  ) {}

  async findOrCreate(
    organizationId: string,
    channelId: string,
    contactId: string,
  ): Promise<Conversation> {
    // Find existing pending or assigned conversation
    const [existing] = await this.dbService.db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.organizationId, organizationId),
          eq(conversations.channelId, channelId),
          eq(conversations.contactId, contactId),
          sql`${conversations.status} IN ('PENDING', 'ASSIGNED')`,
        ),
      )
      .orderBy(desc(conversations.createdAt))
      .limit(1);

    if (existing) {
      return existing;
    }

    // Create new conversation
    const newConv: NewConversation = {
      organizationId,
      channelId,
      contactId,
      status: "PENDING",
    };

    const [conversation] = await this.dbService.db
      .insert(conversations)
      .values(newConv)
      .returning();

    if (!conversation) {
      throw new Error("Failed to create conversation");
    }

    await this.eventsService.create(conversation.id, "CREATED");

    this.logger.log(`Conversation created: ${conversation.id}`);
    return conversation;
  }

  async findAll(
    organizationId: string,
    query: ConversationQueryDto,
  ): Promise<PaginatedResult<ConversationWithRelations>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [eq(conversations.organizationId, organizationId)];

    if (query.status) {
      conditions.push(eq(conversations.status, query.status));
    }

    if (query.channelId) {
      conditions.push(eq(conversations.channelId, query.channelId));
    }

    if (query.agentId) {
      conditions.push(eq(conversations.assignedAgentId, query.agentId));
    }

    const whereClause = and(...conditions);

    // Get conversations with relations using query builder
    const convs = await this.dbService.db.query.conversations.findMany({
      where: whereClause,
      with: {
        contact: true,
        channel: true,
        assignedAgent: true,
      },
      orderBy: [desc(conversations.lastMessageAt), desc(conversations.createdAt)],
      limit,
      offset,
    });

    // Filter by search if provided (contact displayName)
    let filteredConvs = convs;
    if (query.search) {
      const searchLower = query.search.toLowerCase();
      filteredConvs = convs.filter((c) =>
        c.contact.displayName?.toLowerCase().includes(searchLower),
      );
    }

    // Get total count
    const allConvs = await this.dbService.db.select().from(conversations).where(whereClause);

    const total = allConvs.length;

    return {
      data: filteredConvs as ConversationWithRelations[],
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string): Promise<Conversation | null> {
    const [conversation] = await this.dbService.db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id))
      .limit(1);

    return conversation ?? null;
  }

  async findByIdWithRelations(id: string): Promise<ConversationWithRelations | null> {
    const result = await this.dbService.db.query.conversations.findFirst({
      where: eq(conversations.id, id),
      with: {
        contact: true,
        channel: true,
        assignedAgent: true,
      },
    });

    return result as ConversationWithRelations | null;
  }

  async findByIdOrFail(id: string): Promise<Conversation> {
    const conversation = await this.findById(id);
    if (!conversation) {
      throw new NotFoundException("Conversation not found");
    }
    return conversation;
  }

  async accept(conversationId: string, agentId: string): Promise<ConversationWithRelations> {
    const lockKey = `lock:conversation:${conversationId}`;
    const lockTTL = 5000; // 5 seconds

    // Acquire Valkey lock
    const acquired = await this.valkeyService.acquireLock(lockKey, lockTTL, agentId);
    if (!acquired) {
      throw new ConflictException("Conversation is being processed by another agent");
    }

    try {
      // Get conversation and check status
      const conversation = await this.findByIdOrFail(conversationId);

      if (conversation.status !== "PENDING") {
        throw new ConflictException("Conversation is not available for assignment");
      }

      // Update conversation
      await this.dbService.db
        .update(conversations)
        .set({
          status: "ASSIGNED",
          assignedAgentId: agentId,
        })
        .where(eq(conversations.id, conversationId));

      // Record event
      await this.eventsService.create(conversationId, "ACCEPTED", agentId);

      this.logger.log(`Conversation ${conversationId} accepted by agent ${agentId}`);

      // Fetch with relations for response
      const result = await this.findByIdWithRelations(conversationId);
      if (!result) {
        throw new NotFoundException(`Conversation ${conversationId} not found`);
      }
      return result;
    } finally {
      // Always release lock
      await this.valkeyService.releaseLock(lockKey);
    }
  }

  async release(conversationId: string, agentId: string): Promise<ConversationWithRelations> {
    const conversation = await this.findByIdOrFail(conversationId);

    if (conversation.status !== "ASSIGNED") {
      throw new ConflictException("Conversation is not assigned");
    }

    if (conversation.assignedAgentId !== agentId) {
      throw new ForbiddenException("You are not assigned to this conversation");
    }

    // Update conversation
    await this.dbService.db
      .update(conversations)
      .set({
        status: "PENDING",
        assignedAgentId: null,
      })
      .where(eq(conversations.id, conversationId));

    // Record event
    await this.eventsService.create(conversationId, "RELEASED", agentId);

    this.logger.log(`Conversation ${conversationId} released by agent ${agentId}`);

    const result = await this.findByIdWithRelations(conversationId);
    if (!result) {
      throw new NotFoundException(`Conversation ${conversationId} not found`);
    }
    return result;
  }

  async complete(conversationId: string, agentId: string): Promise<ConversationWithRelations> {
    const conversation = await this.findByIdOrFail(conversationId);

    if (conversation.status !== "ASSIGNED") {
      throw new ConflictException("Conversation must be assigned to be completed");
    }

    if (conversation.assignedAgentId !== agentId) {
      throw new ForbiddenException("You are not assigned to this conversation");
    }

    // Update conversation
    await this.dbService.db
      .update(conversations)
      .set({
        status: "COMPLETED",
      })
      .where(eq(conversations.id, conversationId));

    // Record event
    await this.eventsService.create(conversationId, "COMPLETED", agentId);

    this.logger.log(`Conversation ${conversationId} completed by agent ${agentId}`);

    const result = await this.findByIdWithRelations(conversationId);
    if (!result) {
      throw new NotFoundException(`Conversation ${conversationId} not found`);
    }
    return result;
  }

  async reopen(conversationId: string): Promise<Conversation> {
    const conversation = await this.findByIdOrFail(conversationId);

    if (conversation.status !== "COMPLETED") {
      // Already open, no need to reopen
      return conversation;
    }

    // Update conversation
    const [updated] = await this.dbService.db
      .update(conversations)
      .set({
        status: "PENDING",
        assignedAgentId: null,
      })
      .where(eq(conversations.id, conversationId))
      .returning();

    if (!updated) {
      throw new Error("Failed to reopen conversation");
    }

    // Record event
    await this.eventsService.create(conversationId, "REOPENED");

    this.logger.log(`Conversation ${conversationId} reopened`);

    return updated;
  }

  async updateLastMessageAt(conversationId: string): Promise<void> {
    await this.dbService.db
      .update(conversations)
      .set({ lastMessageAt: new Date() })
      .where(eq(conversations.id, conversationId));
  }

  async setFirstResponseAt(conversationId: string): Promise<void> {
    const conversation = await this.findByIdOrFail(conversationId);

    // Only set if not already set
    if (!conversation.firstResponseAt) {
      await this.dbService.db
        .update(conversations)
        .set({ firstResponseAt: new Date() })
        .where(eq(conversations.id, conversationId));
    }
  }

  async getAssignedCount(agentId: string): Promise<number> {
    const result = await this.dbService.db
      .select()
      .from(conversations)
      .where(and(eq(conversations.assignedAgentId, agentId), eq(conversations.status, "ASSIGNED")));

    return result.length;
  }

  async releaseByAgent(agentId: string): Promise<void> {
    // Release all conversations assigned to this agent (used on disconnect)
    const assignedConvs = await this.dbService.db
      .select()
      .from(conversations)
      .where(and(eq(conversations.assignedAgentId, agentId), eq(conversations.status, "ASSIGNED")));

    for (const conv of assignedConvs) {
      await this.dbService.db
        .update(conversations)
        .set({
          status: "PENDING",
          assignedAgentId: null,
        })
        .where(eq(conversations.id, conv.id));

      await this.eventsService.create(conv.id, "AGENT_DISCONNECTED", agentId);
    }

    if (assignedConvs.length > 0) {
      this.logger.log(
        `Released ${assignedConvs.length} conversations from agent ${agentId} (disconnected)`,
      );
    }
  }
}
