import { Injectable, Logger } from "@nestjs/common";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import type { DbService } from "../db/db.service";
import {
  agentSessions,
  conversationEvents,
  conversations,
  messages,
  users,
} from "../db/schema/index";

export interface AgentPerformanceStats {
  agentId: string;
  period: {
    start: Date;
    end: Date;
  };
  conversations: {
    total: number;
    completed: number;
    avgHandleTimeMinutes: number;
    avgFirstResponseSeconds: number;
  };
  messages: {
    sent: number;
  };
}

export interface OrganizationStats {
  organizationId: string;
  period: {
    start: Date;
    end: Date;
  };
  conversations: {
    total: number;
    pending: number;
    assigned: number;
    completed: number;
    avgWaitTimeMinutes: number;
    avgHandleTimeMinutes: number;
  };
  messages: {
    inbound: number;
    outbound: number;
  };
  agents: {
    total: number;
    active: number;
  };
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly dbService: DbService) {}

  // ============================================================
  // Agent Sessions (WebSocket tracking)
  // ============================================================

  async startSession(
    agentId: string,
    connectionId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<string> {
    const [created] = await this.dbService.db
      .insert(agentSessions)
      .values({
        agentId,
        connectionId,
        status: "ONLINE",
        ipAddress,
        userAgent,
      })
      .returning();

    this.logger.log(`Session started for agent ${agentId}: ${created.id}`);
    return created.id;
  }

  async endSession(connectionId: string): Promise<void> {
    await this.dbService.db
      .update(agentSessions)
      .set({ status: "OFFLINE" })
      .where(eq(agentSessions.connectionId, connectionId));

    this.logger.log(`Session ended: ${connectionId}`);
  }

  async updateSessionStatus(
    connectionId: string,
    status: "ONLINE" | "AWAY" | "OFFLINE",
  ): Promise<void> {
    await this.dbService.db
      .update(agentSessions)
      .set({ status, lastSeenAt: new Date() })
      .where(eq(agentSessions.connectionId, connectionId));
  }

  async getActiveSession(agentId: string): Promise<typeof agentSessions.$inferSelect | null> {
    const [session] = await this.dbService.db
      .select()
      .from(agentSessions)
      .where(and(eq(agentSessions.agentId, agentId), eq(agentSessions.status, "ONLINE")))
      .orderBy(desc(agentSessions.createdAt))
      .limit(1);

    return session ?? null;
  }

  async updateLastSeen(connectionId: string): Promise<void> {
    await this.dbService.db
      .update(agentSessions)
      .set({ lastSeenAt: new Date() })
      .where(eq(agentSessions.connectionId, connectionId));
  }

  // ============================================================
  // Agent Performance
  // ============================================================

  async getAgentPerformance(
    agentId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<AgentPerformanceStats> {
    // Get conversations handled by agent
    const agentConvs = await this.dbService.db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.assignedAgentId, agentId),
          gte(conversations.createdAt, startDate),
          lte(conversations.createdAt, endDate),
        ),
      );

    const completedConvs = agentConvs.filter((c) => c.status === "COMPLETED");

    // Calculate average handle time
    let totalHandleTime = 0;
    let totalFirstResponse = 0;
    let convWithFirstResponse = 0;

    for (const conv of completedConvs) {
      // Get accept event
      const [acceptEvent] = await this.dbService.db
        .select()
        .from(conversationEvents)
        .where(
          and(
            eq(conversationEvents.conversationId, conv.id),
            eq(conversationEvents.eventType, "ACCEPTED"),
          ),
        )
        .limit(1);

      // Get complete event
      const [completeEvent] = await this.dbService.db
        .select()
        .from(conversationEvents)
        .where(
          and(
            eq(conversationEvents.conversationId, conv.id),
            eq(conversationEvents.eventType, "COMPLETED"),
          ),
        )
        .orderBy(desc(conversationEvents.createdAt))
        .limit(1);

      if (acceptEvent && completeEvent) {
        const handleTime =
          (completeEvent.createdAt.getTime() - acceptEvent.createdAt.getTime()) / 60000;
        totalHandleTime += handleTime;
      }

      if (conv.firstResponseAt && acceptEvent) {
        const firstResponse =
          (conv.firstResponseAt.getTime() - acceptEvent.createdAt.getTime()) / 1000;
        totalFirstResponse += firstResponse;
        convWithFirstResponse++;
      }
    }

    // Get messages sent by agent
    const agentMessages = await this.dbService.db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.agentId, agentId),
          eq(messages.direction, "OUTBOUND"),
          gte(messages.createdAt, startDate),
          lte(messages.createdAt, endDate),
        ),
      );

    return {
      agentId,
      period: { start: startDate, end: endDate },
      conversations: {
        total: agentConvs.length,
        completed: completedConvs.length,
        avgHandleTimeMinutes:
          completedConvs.length > 0 ? totalHandleTime / completedConvs.length : 0,
        avgFirstResponseSeconds:
          convWithFirstResponse > 0 ? totalFirstResponse / convWithFirstResponse : 0,
      },
      messages: {
        sent: agentMessages.length,
      },
    };
  }

  // ============================================================
  // Organization Stats
  // ============================================================

  async getOrganizationStats(
    organizationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<OrganizationStats> {
    // Get all conversations
    const orgConvs = await this.dbService.db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.organizationId, organizationId),
          gte(conversations.createdAt, startDate),
          lte(conversations.createdAt, endDate),
        ),
      );

    const pendingCount = orgConvs.filter((c) => c.status === "PENDING").length;
    const assignedCount = orgConvs.filter((c) => c.status === "ASSIGNED").length;
    const completedCount = orgConvs.filter((c) => c.status === "COMPLETED").length;

    // Calculate wait time (time from creation to first accept)
    let totalWaitTime = 0;
    let convsWithWait = 0;

    // Calculate handle time
    let totalHandleTime = 0;

    for (const conv of orgConvs.filter((c) => c.status === "COMPLETED")) {
      const [acceptEvent] = await this.dbService.db
        .select()
        .from(conversationEvents)
        .where(
          and(
            eq(conversationEvents.conversationId, conv.id),
            eq(conversationEvents.eventType, "ACCEPTED"),
          ),
        )
        .orderBy(conversationEvents.createdAt)
        .limit(1);

      if (acceptEvent) {
        const waitTime = (acceptEvent.createdAt.getTime() - conv.createdAt.getTime()) / 60000;
        totalWaitTime += waitTime;
        convsWithWait++;
      }

      const [completeEvent] = await this.dbService.db
        .select()
        .from(conversationEvents)
        .where(
          and(
            eq(conversationEvents.conversationId, conv.id),
            eq(conversationEvents.eventType, "COMPLETED"),
          ),
        )
        .orderBy(desc(conversationEvents.createdAt))
        .limit(1);

      if (acceptEvent && completeEvent) {
        const handleTime =
          (completeEvent.createdAt.getTime() - acceptEvent.createdAt.getTime()) / 60000;
        totalHandleTime += handleTime;
      }
    }

    // Get messages
    const orgMessages = await this.dbService.db
      .select()
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(
        and(
          eq(conversations.organizationId, organizationId),
          gte(messages.createdAt, startDate),
          lte(messages.createdAt, endDate),
        ),
      );

    const inboundCount = orgMessages.filter((m) => m.messages.direction === "INBOUND").length;
    const outboundCount = orgMessages.filter((m) => m.messages.direction === "OUTBOUND").length;

    // Get total agents in organization
    const orgUsers = await this.dbService.db
      .select()
      .from(users)
      .where(eq(users.organizationId, organizationId));

    // Get currently active agents (via sessions)
    const activeSessions = await this.dbService.db
      .select()
      .from(agentSessions)
      .innerJoin(users, eq(agentSessions.agentId, users.id))
      .where(and(eq(users.organizationId, organizationId), eq(agentSessions.status, "ONLINE")));

    // Get unique active agents
    const activeAgentIds = new Set(activeSessions.map((s) => s.agent_sessions.agentId));

    return {
      organizationId,
      period: { start: startDate, end: endDate },
      conversations: {
        total: orgConvs.length,
        pending: pendingCount,
        assigned: assignedCount,
        completed: completedCount,
        avgWaitTimeMinutes: convsWithWait > 0 ? totalWaitTime / convsWithWait : 0,
        avgHandleTimeMinutes: completedCount > 0 ? totalHandleTime / completedCount : 0,
      },
      messages: {
        inbound: inboundCount,
        outbound: outboundCount,
      },
      agents: {
        total: orgUsers.length,
        active: activeAgentIds.size,
      },
    };
  }

  // ============================================================
  // Real-time Dashboard Stats
  // ============================================================

  async getDashboardStats(organizationId: string): Promise<{
    pendingConversations: number;
    activeAgents: number;
    avgWaitMinutes: number;
    todayConversations: number;
    todayMessages: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Pending conversations
    const pendingConvs = await this.dbService.db
      .select()
      .from(conversations)
      .where(
        and(eq(conversations.organizationId, organizationId), eq(conversations.status, "PENDING")),
      );

    // Active agents
    const activeSessions = await this.dbService.db
      .select()
      .from(agentSessions)
      .innerJoin(users, eq(agentSessions.agentId, users.id))
      .where(and(eq(users.organizationId, organizationId), eq(agentSessions.status, "ONLINE")));

    const activeAgentIds = new Set(activeSessions.map((s) => s.agent_sessions.agentId));

    // Average wait time for pending
    let totalWait = 0;
    const now = new Date();
    for (const conv of pendingConvs) {
      totalWait += (now.getTime() - conv.createdAt.getTime()) / 60000;
    }

    // Today's conversations
    const todayConvs = await this.dbService.db
      .select()
      .from(conversations)
      .where(
        and(eq(conversations.organizationId, organizationId), gte(conversations.createdAt, today)),
      );

    // Today's messages
    const todayMsgs = await this.dbService.db
      .select()
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(and(eq(conversations.organizationId, organizationId), gte(messages.createdAt, today)));

    return {
      pendingConversations: pendingConvs.length,
      activeAgents: activeAgentIds.size,
      avgWaitMinutes: pendingConvs.length > 0 ? Math.round(totalWait / pendingConvs.length) : 0,
      todayConversations: todayConvs.length,
      todayMessages: todayMsgs.length,
    };
  }
}
