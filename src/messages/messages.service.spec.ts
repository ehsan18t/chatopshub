import { NotFoundException } from "@nestjs/common";
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ConversationEventsService } from "../conversations/conversation-events.service";
import type { ConversationsService } from "../conversations/conversations.service";
import type { DbService } from "../db/db.service";
import { MessagesService } from "./messages.service";

const mockMessage = {
  id: "msg-1",
  conversationId: "conv-1",
  direction: "INBOUND" as const,
  agentId: null,
  body: "Hello",
  mediaUrl: null,
  mediaType: null,
  providerMessageId: "provider-msg-1",
  status: "DELIVERED" as const,
  errorCode: null,
  errorMessage: null,
  metadata: {},
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("MessagesService", () => {
  let service: MessagesService;
  let mockDbService: DbService;
  let mockEventsService: ConversationEventsService;
  let mockConversationsService: ConversationsService;

  beforeEach(() => {
    mockDbService = {
      db: {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockMessage]),
          }),
        }),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([mockMessage]),
              }),
              limit: vi.fn().mockResolvedValue([mockMessage]),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([mockMessage]),
            }),
          }),
        }),
      },
    } as unknown as DbService;

    mockEventsService = {
      create: vi.fn().mockResolvedValue({ id: "event-1" }),
    } as unknown as ConversationEventsService;

    mockConversationsService = {
      updateLastMessageAt: vi.fn().mockResolvedValue(undefined),
      setFirstResponseAt: vi.fn().mockResolvedValue(undefined),
      reopen: vi.fn().mockResolvedValue({ id: "conv-1" }),
    } as unknown as ConversationsService;

    service = new MessagesService(mockDbService, mockEventsService, mockConversationsService);
  });

  describe("create", () => {
    it("should create inbound message successfully", async () => {
      const dto = { body: "Hello" };

      const result = await service.create("conv-1", "INBOUND", dto);

      expect(result).toBeDefined();
      expect(result.id).toBe("msg-1");
      expect(mockConversationsService.updateLastMessageAt).toHaveBeenCalledWith("conv-1");
      expect(mockConversationsService.reopen).toHaveBeenCalledWith("conv-1");
    });

    it("should create outbound message and set first response time", async () => {
      const outboundMessage = {
        ...mockMessage,
        direction: "OUTBOUND" as const,
        agentId: "agent-1",
      };
      mockDbService.db.insert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([outboundMessage]),
        }),
      });

      const dto = { body: "Reply" };

      const result = await service.create("conv-1", "OUTBOUND", dto, "agent-1");

      expect(result).toBeDefined();
      expect(mockConversationsService.setFirstResponseAt).toHaveBeenCalledWith("conv-1");
    });
  });

  describe("findById", () => {
    it("should return message when found", async () => {
      const result = await service.findById("msg-1");

      expect(result).toBeDefined();
      expect(result?.id).toBe("msg-1");
    });

    it("should return null when message not found", async () => {
      mockDbService.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await service.findById("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("findByIdOrFail", () => {
    it("should return message when found", async () => {
      vi.spyOn(service, "findById").mockResolvedValue(mockMessage);

      const result = await service.findByIdOrFail("msg-1");

      expect(result.id).toBe("msg-1");
    });

    it("should throw NotFoundException when message not found", async () => {
      vi.spyOn(service, "findById").mockResolvedValue(null);

      await expect(service.findByIdOrFail("non-existent")).rejects.toThrow(NotFoundException);
    });
  });

  describe("findByProviderMessageId", () => {
    it("should return message when found", async () => {
      const result = await service.findByProviderMessageId("provider-msg-1");

      expect(result).toBeDefined();
      expect(result?.providerMessageId).toBe("provider-msg-1");
    });

    it("should return null when not found", async () => {
      mockDbService.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await service.findByProviderMessageId("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("findByConversation", () => {
    it("should return paginated messages", async () => {
      mockDbService.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockMessage]),
            }),
          }),
        }),
      });

      const result = await service.findByConversation("conv-1");

      expect(result.data).toBeDefined();
      expect(result.nextCursor).toBeNull();
    });

    it("should return nextCursor when more messages exist", async () => {
      const manyMessages = Array(51)
        .fill(null)
        .map((_, i) => ({ ...mockMessage, id: `msg-${i}` }));
      mockDbService.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(manyMessages),
            }),
          }),
        }),
      });

      const result = await service.findByConversation("conv-1");

      expect(result.nextCursor).not.toBeNull();
      expect(result.data.length).toBe(50);
    });
  });

  describe("updateStatus", () => {
    it("should update message status to DELIVERED", async () => {
      vi.spyOn(service, "findByIdOrFail").mockResolvedValue(mockMessage);

      const result = await service.updateStatus("msg-1", "DELIVERED");

      expect(result).toBeDefined();
      expect(mockEventsService.create).toHaveBeenCalled();
    });

    it("should update message status to FAILED with error details", async () => {
      vi.spyOn(service, "findByIdOrFail").mockResolvedValue(mockMessage);

      await service.updateStatus("msg-1", "FAILED", "ERR001", "Failed to send");

      expect(mockEventsService.create).toHaveBeenCalled();
    });

    it("should throw NotFoundException when message not found", async () => {
      vi.spyOn(service, "findByIdOrFail").mockRejectedValue(
        new NotFoundException("Message not found"),
      );

      await expect(service.updateStatus("non-existent", "DELIVERED")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("markDelivered", () => {
    it("should mark message as delivered", async () => {
      vi.spyOn(service, "findByProviderMessageId").mockResolvedValue(mockMessage);
      vi.spyOn(service, "updateStatus").mockResolvedValue({ ...mockMessage, status: "DELIVERED" });

      await service.markDelivered("provider-msg-1");

      expect(service.updateStatus).toHaveBeenCalledWith("msg-1", "DELIVERED");
    });

    it("should do nothing when message not found", async () => {
      vi.spyOn(service, "findByProviderMessageId").mockResolvedValue(null);
      vi.spyOn(service, "updateStatus");

      await service.markDelivered("non-existent");

      expect(service.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe("markRead", () => {
    it("should mark message as read", async () => {
      vi.spyOn(service, "findByProviderMessageId").mockResolvedValue(mockMessage);
      vi.spyOn(service, "updateStatus").mockResolvedValue({ ...mockMessage, status: "READ" });

      await service.markRead("provider-msg-1");

      expect(service.updateStatus).toHaveBeenCalledWith("msg-1", "READ");
    });
  });

  describe("markFailed", () => {
    it("should mark message as failed with error details", async () => {
      vi.spyOn(service, "findByProviderMessageId").mockResolvedValue(mockMessage);
      vi.spyOn(service, "updateStatus").mockResolvedValue({ ...mockMessage, status: "FAILED" });

      await service.markFailed("provider-msg-1", "ERR001", "Failed to send");

      expect(service.updateStatus).toHaveBeenCalledWith(
        "msg-1",
        "FAILED",
        "ERR001",
        "Failed to send",
      );
    });
  });
});
