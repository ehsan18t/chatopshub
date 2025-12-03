import { Logger } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { createAdapter } from "@socket.io/redis-adapter";
import type { Server, Socket } from "socket.io";
import type { ConversationsService } from "../conversations/conversations.service";
import type { ValkeyService } from "../valkey/valkey.service";

// Events that the server emits to clients
export enum ServerEvent {
  // Connection events
  CONNECTED = "connected",
  ERROR = "error",

  // Conversation events
  CONVERSATION_NEW = "conversation:new",
  CONVERSATION_UPDATED = "conversation:updated",
  CONVERSATION_ASSIGNED = "conversation:assigned",
  CONVERSATION_RELEASED = "conversation:released",
  CONVERSATION_COMPLETED = "conversation:completed",

  // Message events
  MESSAGE_NEW = "message:new",
  MESSAGE_UPDATED = "message:updated",
  MESSAGE_DELIVERED = "message:delivered",
  MESSAGE_READ = "message:read",

  // Agent events
  AGENT_STATUS_CHANGED = "agent:status_changed",
  AGENT_TYPING = "agent:typing",
}

// Events that clients can emit
export enum ClientEvent {
  JOIN_ORGANIZATION = "join:organization",
  LEAVE_ORGANIZATION = "leave:organization",
  JOIN_CONVERSATION = "join:conversation",
  LEAVE_CONVERSATION = "leave:conversation",
  TYPING_START = "typing:start",
  TYPING_STOP = "typing:stop",
  SET_STATUS = "set:status",
}

interface AuthenticatedSocket extends Socket {
  userId?: string;
  organizationId?: string;
}

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN?.split(",") ?? ["http://localhost:3000"],
    credentials: true,
  },
  namespace: "/",
})
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EventsGateway.name);
  private readonly connectedAgents = new Map<string, Set<string>>(); // organizationId -> Set of socket ids

  constructor(
    private readonly valkeyService: ValkeyService,
    private readonly conversationsService: ConversationsService,
  ) {}

  async afterInit(server: Server): Promise<void> {
    this.logger.log("WebSocket Gateway initialized");

    // Set up Redis adapter for horizontal scaling
    try {
      const pubClient = this.valkeyService.getClient();
      const subClient = pubClient.duplicate();

      await subClient.connect();

      server.adapter(createAdapter(pubClient, subClient));
      this.logger.log("Redis adapter configured for WebSocket scaling");
    } catch (error) {
      this.logger.error(`Failed to configure Redis adapter: ${error}`);
    }
  }

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    // In production, validate JWT token from handshake
    const userId = client.handshake.auth?.userId;
    const organizationId = client.handshake.auth?.organizationId;

    if (!userId || !organizationId) {
      this.logger.warn(`Connection rejected: missing auth data for socket ${client.id}`);
      client.emit(ServerEvent.ERROR, { message: "Authentication required" });
      client.disconnect();
      return;
    }

    // Store user info on socket
    client.userId = userId;
    client.organizationId = organizationId;

    // Join organization room
    await client.join(`org:${organizationId}`);
    // Join user-specific room for targeted messages
    await client.join(`user:${userId}`);

    // Track connected agent
    if (!this.connectedAgents.has(organizationId)) {
      this.connectedAgents.set(organizationId, new Set());
    }
    this.connectedAgents.get(organizationId)?.add(client.id);

    // Store session in Valkey (24 hour TTL)
    await this.valkeyService.setSession(
      userId,
      {
        socketId: client.id,
        organizationId,
        status: "ONLINE",
        connectedAt: new Date().toISOString(),
      },
      86400,
    );

    // Notify organization of agent coming online
    this.server.to(`org:${organizationId}`).emit(ServerEvent.AGENT_STATUS_CHANGED, {
      userId,
      status: "ONLINE",
    });

    client.emit(ServerEvent.CONNECTED, {
      socketId: client.id,
      userId,
      organizationId,
    });

    this.logger.log(`Agent ${userId} connected (socket: ${client.id})`);
  }

  async handleDisconnect(client: AuthenticatedSocket): Promise<void> {
    const userId = client.userId;
    const organizationId = client.organizationId;

    if (!userId || !organizationId) {
      return;
    }

    // Remove from tracking
    this.connectedAgents.get(organizationId)?.delete(client.id);
    if (this.connectedAgents.get(organizationId)?.size === 0) {
      this.connectedAgents.delete(organizationId);
    }

    // Clear session
    await this.valkeyService.deleteSession(userId);

    // Release all conversations assigned to this agent
    await this.conversationsService.releaseByAgent(userId);

    // Notify organization of agent going offline
    this.server.to(`org:${organizationId}`).emit(ServerEvent.AGENT_STATUS_CHANGED, {
      userId,
      status: "OFFLINE",
    });

    this.logger.log(`Agent ${userId} disconnected (socket: ${client.id})`);
  }

  @SubscribeMessage(ClientEvent.JOIN_CONVERSATION)
  async handleJoinConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ): Promise<void> {
    const { conversationId } = data;

    // Verify user can access this conversation (same org)
    const conversation = await this.conversationsService.findById(conversationId);
    if (!conversation || conversation.organizationId !== client.organizationId) {
      client.emit(ServerEvent.ERROR, { message: "Conversation not found" });
      return;
    }

    await client.join(`conv:${conversationId}`);
    this.logger.debug(`Agent ${client.userId} joined conversation ${conversationId}`);
  }

  @SubscribeMessage(ClientEvent.LEAVE_CONVERSATION)
  async handleLeaveConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ): Promise<void> {
    const { conversationId } = data;
    await client.leave(`conv:${conversationId}`);
    this.logger.debug(`Agent ${client.userId} left conversation ${conversationId}`);
  }

  @SubscribeMessage(ClientEvent.TYPING_START)
  async handleTypingStart(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ): Promise<void> {
    const { conversationId } = data;

    this.server.to(`conv:${conversationId}`).emit(ServerEvent.AGENT_TYPING, {
      conversationId,
      userId: client.userId,
      isTyping: true,
    });
  }

  @SubscribeMessage(ClientEvent.TYPING_STOP)
  async handleTypingStop(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ): Promise<void> {
    const { conversationId } = data;

    this.server.to(`conv:${conversationId}`).emit(ServerEvent.AGENT_TYPING, {
      conversationId,
      userId: client.userId,
      isTyping: false,
    });
  }

  @SubscribeMessage(ClientEvent.SET_STATUS)
  async handleSetStatus(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { status: "ONLINE" | "BUSY" | "AWAY" },
  ): Promise<void> {
    const { status } = data;
    const userId = client.userId;
    const organizationId = client.organizationId;

    if (!userId || !organizationId) {
      return;
    }

    // Update session in Valkey with new status
    await this.valkeyService.setSession(
      userId,
      {
        socketId: client.id,
        organizationId,
        status,
        connectedAt: new Date().toISOString(),
      },
      86400,
    );

    this.server.to(`org:${organizationId}`).emit(ServerEvent.AGENT_STATUS_CHANGED, {
      userId,
      status,
    });

    this.logger.debug(`Agent ${userId} status changed to ${status}`);
  }

  // ============================================================
  // Methods for emitting events from other services
  // ============================================================

  emitToOrganization(organizationId: string, event: ServerEvent, data: unknown): void {
    this.server.to(`org:${organizationId}`).emit(event, data);
  }

  emitToConversation(conversationId: string, event: ServerEvent, data: unknown): void {
    this.server.to(`conv:${conversationId}`).emit(event, data);
  }

  emitToUser(userId: string, event: ServerEvent, data: unknown): void {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  // Convenience methods
  notifyNewConversation(organizationId: string, conversation: unknown): void {
    this.emitToOrganization(organizationId, ServerEvent.CONVERSATION_NEW, conversation);
  }

  notifyConversationAssigned(
    organizationId: string,
    conversationId: string,
    agentId: string,
  ): void {
    this.emitToOrganization(organizationId, ServerEvent.CONVERSATION_ASSIGNED, {
      conversationId,
      agentId,
    });
  }

  notifyConversationReleased(organizationId: string, conversationId: string): void {
    this.emitToOrganization(organizationId, ServerEvent.CONVERSATION_RELEASED, {
      conversationId,
    });
  }

  notifyNewMessage(conversationId: string, organizationId: string, message: unknown): void {
    this.emitToConversation(conversationId, ServerEvent.MESSAGE_NEW, message);
    // Also notify organization for inbox updates
    this.emitToOrganization(organizationId, ServerEvent.MESSAGE_NEW, message);
  }

  notifyMessageDelivered(conversationId: string, messageId: string): void {
    this.emitToConversation(conversationId, ServerEvent.MESSAGE_DELIVERED, {
      messageId,
    });
  }

  notifyMessageRead(conversationId: string, messageId: string): void {
    this.emitToConversation(conversationId, ServerEvent.MESSAGE_READ, {
      messageId,
    });
  }

  getConnectedAgentCount(organizationId: string): number {
    return this.connectedAgents.get(organizationId)?.size ?? 0;
  }
}
