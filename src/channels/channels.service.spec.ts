import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DbService } from "@/db/db.service";
import { ChannelsService } from "./channels.service";

const mockChannel = {
  id: "channel-1",
  organizationId: "org-1",
  provider: "WHATSAPP" as const,
  name: "Test Channel",
  config: { phoneNumberId: "123", accessToken: "token" },
  webhookSecret: "secret",
  status: "ACTIVE" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("ChannelsService", () => {
  let service: ChannelsService;
  let mockDbService: DbService;

  beforeEach(() => {
    mockDbService = {
      db: {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockChannel]),
          }),
        }),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockChannel]),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([mockChannel]),
            }),
          }),
        }),
        delete: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      },
    } as unknown as DbService;

    service = new ChannelsService(mockDbService);
  });

  describe("create", () => {
    it("should create a new channel successfully", async () => {
      const dto = {
        provider: "WHATSAPP" as const,
        name: "New Channel",
        config: { phoneNumberId: "456", accessToken: "token123" },
        webhookSecret: "new-secret",
      };

      const result = await service.create("org-1", dto);

      expect(result).toBeDefined();
      expect(result.id).toBe("channel-1");
    });
  });

  describe("findAll", () => {
    it("should return list of channels", async () => {
      mockDbService.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockChannel]),
          }),
        }),
      });

      const result = await service.findAll("org-1");

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("channel-1");
    });

    it("should respect limit parameter", async () => {
      const limitMock = vi.fn().mockResolvedValue([]);
      mockDbService.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: limitMock,
          }),
        }),
      });

      await service.findAll("org-1", 50);

      expect(limitMock).toHaveBeenCalledWith(50);
    });
  });

  describe("findById", () => {
    it("should return channel when found", async () => {
      const result = await service.findById("channel-1");

      expect(result).toBeDefined();
      expect(result?.id).toBe("channel-1");
    });

    it("should return null when channel not found", async () => {
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
    it("should return channel when found", async () => {
      vi.spyOn(service, "findById").mockResolvedValue(mockChannel);

      const result = await service.findByIdOrFail("channel-1");

      expect(result.id).toBe("channel-1");
    });

    it("should throw NotFoundException when channel not found", async () => {
      vi.spyOn(service, "findById").mockResolvedValue(null);

      await expect(service.findByIdOrFail("non-existent")).rejects.toThrow(NotFoundException);
    });
  });

  describe("findByProvider", () => {
    it("should return channels filtered by provider", async () => {
      mockDbService.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockChannel]),
          }),
        }),
      });

      const result = await service.findByProvider("org-1", "WHATSAPP");

      expect(result).toHaveLength(1);
      expect(result[0]?.provider).toBe("WHATSAPP");
    });
  });

  describe("update", () => {
    it("should update channel successfully", async () => {
      vi.spyOn(service, "findByIdOrFail").mockResolvedValue(mockChannel);

      const result = await service.update("channel-1", { name: "Updated Name" });

      expect(result).toBeDefined();
    });

    it("should throw NotFoundException when channel not found", async () => {
      vi.spyOn(service, "findByIdOrFail").mockRejectedValue(
        new NotFoundException("Channel not found"),
      );

      await expect(service.update("non-existent", { name: "Test" })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("delete", () => {
    it("should delete channel successfully", async () => {
      vi.spyOn(service, "findByIdOrFail").mockResolvedValue(mockChannel);

      await expect(service.delete("channel-1")).resolves.toBeUndefined();
    });

    it("should throw NotFoundException when channel not found", async () => {
      vi.spyOn(service, "findByIdOrFail").mockRejectedValue(
        new NotFoundException("Channel not found"),
      );

      await expect(service.delete("non-existent")).rejects.toThrow(NotFoundException);
    });
  });

  describe("testConnection", () => {
    it("should return success for existing channel", async () => {
      vi.spyOn(service, "findByIdOrFail").mockResolvedValue(mockChannel);

      const result = await service.testConnection("channel-1");

      expect(result.success).toBe(true);
      expect(result.message).toContain("WHATSAPP");
    });

    it("should throw NotFoundException when channel not found", async () => {
      vi.spyOn(service, "findByIdOrFail").mockRejectedValue(
        new NotFoundException("Channel not found"),
      );

      await expect(service.testConnection("non-existent")).rejects.toThrow(NotFoundException);
    });
  });
});
